package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PersonajeFavoritoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Alertas de "tu favorito se está moviendo": cuando un personaje que el usuario
 * sigue sube o baja de forma notable en el ranking, le llega una notificación.
 *
 * <p>Estrategia (server-authoritative, fan-out de baja frecuencia):
 * <ol>
 *   <li>Acotamos el cálculo a los personajes que tiene <em>alguien</em> como
 *       favorito ({@link PersonajeFavoritoRepository#findPersonajeIdsConSeguidores()}),
 *       no a todo el catálogo.</li>
 *   <li>Reusamos {@link RankingMovimientosService#calcularDeltasPosicion} sobre
 *       una ventana ({@code ventanaDias}) para obtener el delta de posición.</li>
 *   <li>Para cada personaje con {@code |delta| >= umbralPuestos} notificamos a
 *       sus seguidores (con tope por personaje), de forma idempotente por
 *       personaje/día/dirección (vía {@code eventoKey}).</li>
 * </ol>
 *
 * <p>Lo invoca {@link AlertaFavoritoMovimientoJob} una vez al día. Es best-effort:
 * el fallo de un personaje no detiene al resto y nunca rompe el job.
 */
@Service
public class AlertaFavoritoMovimientoService {

    private static final Logger log = LoggerFactory.getLogger(AlertaFavoritoMovimientoService.class);
    // Serializa el payload por Jackson en vez de concatenar a mano: un slug con
    // comillas/backslash rompería el JSON interpolado (y es entrada potencialmente
    // no confiable). ObjectMapper es thread-safe para serializar.
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Tope de seguidores notificados por personaje y ejecución. */
    static final int MAX_FANOUT_POR_PERSONAJE = 500;

    private final PersonajeFavoritoRepository favoritoRepository;
    private final PersonajeRepository personajeRepository;
    private final RankingMovimientosService rankingMovimientosService;
    private final NotificacionService notificacionService;
    private final Clock clock;
    private final int umbralPuestos;
    private final int ventanaDias;

    public AlertaFavoritoMovimientoService(
            PersonajeFavoritoRepository favoritoRepository,
            PersonajeRepository personajeRepository,
            RankingMovimientosService rankingMovimientosService,
            NotificacionService notificacionService,
            Clock clock,
            @Value("${app.alertas-favorito.umbral-puestos:15}") int umbralPuestos,
            @Value("${app.alertas-favorito.ventana-dias:7}") int ventanaDias) {
        this.favoritoRepository = favoritoRepository;
        this.personajeRepository = personajeRepository;
        this.rankingMovimientosService = rankingMovimientosService;
        this.notificacionService = notificacionService;
        this.clock = clock;
        this.umbralPuestos = Math.max(1, umbralPuestos);
        this.ventanaDias = Math.max(1, ventanaDias);
    }

    /**
     * Calcula los movimientos de los personajes favoritados y notifica a los
     * seguidores de los que se movieron {@code >= umbralPuestos} en la ventana.
     *
     * @return total de notificaciones nuevas creadas.
     */
    public int notificarMovimientos() {
        List<Long> ids = favoritoRepository.findPersonajeIdsConSeguidores();
        if (ids.isEmpty()) {
            return 0;
        }
        LocalDateTime fin = LocalDateTime.now(clock);
        LocalDateTime inicio = fin.minusDays(ventanaDias);
        Map<Long, Integer> deltas = rankingMovimientosService.calcularDeltasPosicion(ids, inicio, fin);

        LocalDate dia = fin.toLocalDate();
        int total = 0;
        for (Map.Entry<Long, Integer> entrada : deltas.entrySet()) {
            int delta = entrada.getValue();
            if (Math.abs(delta) < umbralPuestos) {
                continue;
            }
            try {
                total += notificarPersonaje(entrada.getKey(), delta, dia);
            } catch (Exception e) {
                log.warn("Alerta favorito: personaje={} falló: {}", entrada.getKey(), e.getMessage());
            }
        }
        if (total > 0) {
            log.info("Alertas de favorito en movimiento: {} notificaciones creadas", total);
        }
        return total;
    }

    /**
     * Notifica a los seguidores de un personaje concreto. Cada notificación va
     * por su propia transacción ({@link NotificacionService#crearSiNoExiste}),
     * así que es idempotente y un duplicado no cuenta como creación.
     */
    int notificarPersonaje(Long personajeId, int delta, LocalDate dia) {
        Personaje personaje = personajeRepository.findById(personajeId).orElse(null);
        if (personaje == null) {
            return 0;
        }
        boolean subio = delta > 0;
        int puestos = Math.abs(delta);
        String nombre = personaje.getNombre();
        String titulo = subio
                ? nombre + " está subiendo en el ranking"
                : nombre + " está bajando en el ranking";
        String mensaje = subio
                ? nombre + " subió " + puestos + " puestos en los últimos " + ventanaDias
                        + " días. ¡Apoya su racha con tu voto!"
                : nombre + " bajó " + puestos + " puestos en los últimos " + ventanaDias
                        + " días. Necesita tus votos para remontar.";
        String payload = construirPayload(personaje.getSlug(), delta);
        String eventoKey = "fav-mov:" + personajeId + ":" + dia + ":" + (subio ? "up" : "down");

        List<Usuario> seguidores = favoritoRepository.findUsuariosByPersonajeId(
                personajeId, PageRequest.of(0, MAX_FANOUT_POR_PERSONAJE));
        int creadas = 0;
        for (Usuario seguidor : seguidores) {
            if (notificacionService.crearSiNoExiste(seguidor, NotificacionTipo.FAVORITO_MOVIMIENTO,
                    titulo, mensaje, payload, eventoKey)) {
                creadas++;
            }
        }
        return creadas;
    }

    private static String construirPayload(String slug, int delta) {
        try {
            return JSON.writeValueAsString(Map.of("slug", slug == null ? "" : slug, "delta", delta));
        } catch (JsonProcessingException e) {
            // Tipos triviales (String + int): no debería ocurrir. Fallback sin slug.
            return "{\"delta\":" + delta + "}";
        }
    }
}
