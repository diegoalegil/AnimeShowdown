package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Prediccion;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;

/**
 * Predicciones de bracket.
 *
 * <p>API:
 * <ul>
 *   <li>{@link #aplicar(Usuario, Long, Long)} — crea o actualiza la
 *       predicción del usuario sobre un enfrentamiento. Idempotente:
 *       puede llamarse repetidamente mientras el match esté abierto.</li>
 *   <li>{@link #listarPorUsuarioYTorneo(Usuario, Torneo)} — para el
 *       endpoint "mis predicciones de este torneo".</li>
 *   <li>{@link #resolverParaTorneo(Torneo)} — invocado por
 *       {@code TorneoService.finalizar} antes del save final. Marca
 *       acertada=true/false en cada predicción y publica un evento por
 *       usuario con totales + racha.</li>
 *   <li>{@link #leaderboard(int, int)} — top N usuarios por aciertos en
 *       los últimos N días.</li>
 * </ul>
 */
@Service
public class PrediccionService {

    private static final Logger log = LoggerFactory.getLogger(PrediccionService.class);

    private final PrediccionRepository repo;
    private final EnfrentamientoRepository enfRepo;
    private final PersonajeRepository personajeRepo;
    private final ApplicationEventPublisher eventPublisher;

    public PrediccionService(PrediccionRepository repo,
            EnfrentamientoRepository enfRepo,
            PersonajeRepository personajeRepo,
            ApplicationEventPublisher eventPublisher) {
        this.repo = repo;
        this.enfRepo = enfRepo;
        this.personajeRepo = personajeRepo;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Crea o actualiza una predicción. Lanza IllegalArgumentException con
     * mensaje legible si los inputs no son válidos para que el controller
     * lo traduzca a 400 con un body útil para el frontend.
     */
    @Transactional
    public Prediccion aplicar(Usuario usuario, Long enfrentamientoId, Long personajePredichoId) {
        Enfrentamiento enf = enfRepo.findById(enfrentamientoId)
                .orElseThrow(() -> new IllegalArgumentException("Enfrentamiento no encontrado"));

        // si el torneo está PENDIENTE o RECHAZADO,
        // las predicciones no aplican — el torneo no es público. Antes
        // permitía crear una predicción sobre un torneo en cola de
        // moderación, filtrando su existencia por id directo.
        EstadoRevision rev = enf.getTorneo().getEstadoRevision();
        if (rev == EstadoRevision.PENDIENTE || rev == EstadoRevision.RECHAZADO) {
            throw new IllegalArgumentException("Enfrentamiento no encontrado");
        }
        if (enf.getTorneo().getEstado() == EstadoTorneo.FINISHED) {
            throw new IllegalArgumentException("No puedes predecir en un torneo ya finalizado");
        }
        if (enf.getGanador() != null) {
            throw new IllegalArgumentException("Este enfrentamiento ya está resuelto");
        }
        if (enf.getPersonaje1() == null || enf.getPersonaje2() == null) {
            throw new IllegalArgumentException("El enfrentamiento todavía no tiene rivales asignados");
        }
        if (!enf.getPersonaje1().getId().equals(personajePredichoId)
                && !enf.getPersonaje2().getId().equals(personajePredichoId)) {
            throw new IllegalArgumentException("El personaje predicho no pertenece a este enfrentamiento");
        }

        Personaje predicho = personajeRepo.findById(personajePredichoId)
                .orElseThrow(() -> new IllegalArgumentException("Personaje no encontrado"));

        Optional<Prediccion> existente = repo.findByUsuarioAndEnfrentamiento(usuario, enf);
        if (existente.isPresent()) {
            Prediccion p = existente.get();
            p.setPersonajePredicho(predicho);
            return repo.save(p);
        }
        return repo.save(new Prediccion(usuario, enf, predicho));
    }

    @Transactional(readOnly = true)
    public List<Prediccion> listarPorUsuarioYTorneo(Usuario usuario, Torneo torneo) {
        return repo.findByUsuarioAndTorneo(usuario, torneo);
    }

    /**
     * Devuelve las predicciones del usuario en el torneo ya mapeadas a DTO
     * dentro de la transacción para evitar LazyInitializationException al
     * acceder a {@code personajePredicho} desde el controller. Mismo patrón
     * que en BadgeService.listarCatalogoConDesbloqueos.
     */
    @Transactional(readOnly = true)
    public List<com.diegoalegil.animeshowdown.dto.PrediccionDto> listarDtoPorUsuarioYTorneo(
            Usuario usuario, Torneo torneo) {
        return repo.findByUsuarioAndTorneo(usuario, torneo).stream()
                .map(com.diegoalegil.animeshowdown.dto.PrediccionDto::from)
                .toList();
    }

    /**
     * Marca acertada=true/false en cada predicción del torneo comparando
     * contra el ganador del enfrentamiento correspondiente. Publica un
     * {@link PrediccionResueltaEvent} por usuario afectado con totales y
     * racha más reciente. Llamado desde {@code TorneoService.finalizar}.
     *
     * @return número de predicciones resueltas (acertadas + falladas).
     */
    @Transactional
    public int resolverParaTorneo(Torneo torneo) {
        List<Prediccion> predicciones = repo.findByTorneo(torneo);
        Set<Long> usuariosAfectados = new HashSet<>();

        for (Prediccion p : predicciones) {
            // Saltar las ya resueltas (idempotencia si por algún motivo se
            // llamara dos veces).
            if (p.estaResuelta()) continue;
            Personaje ganador = p.getEnfrentamiento().getGanador();
            if (ganador == null) {
                // Match sin ganador definitivo (empate exacto en votos) →
                // dejamos la predicción como pendiente. Caso raro pero posible.
                continue;
            }
            boolean acerto = ganador.getId().equals(p.getPersonajePredicho().getId());
            p.setAcertada(acerto);
            repo.save(p);
            usuariosAfectados.add(p.getUsuario().getId());
        }

        log.info("Predicciones resueltas: torneo={} total={} usuariosAfectados={}",
                torneo.getId(), predicciones.size(), usuariosAfectados.size());

        // Publicar un evento por usuario afectado. BadgeEventListener
        // escucha y comprueba 3-seguidas / 10-seguidas / profeta(20).
        emitirEventosPorUsuario(usuariosAfectados);

        return (int) predicciones.stream().filter(Prediccion::estaResuelta).count();
    }

    private void emitirEventosPorUsuario(Set<Long> usuariosAfectados) {
        // Map usuarioId -> {totalAciertos, rachaActual}. Necesitamos cargar
        // las últimas resueltas del usuario para calcular la racha.
        for (Long usuarioId : usuariosAfectados) {
            try {
                // Cargamos las últimas 20 resueltas (suficiente para detectar
                // racha de 10 consecutivos, máximo badge de streak).
                List<Prediccion> ultimas = repo.findResueltasDelUsuarioDesc(
                        cargarUsuarioPorId(usuarioId),
                        PageRequest.of(0, 20));
                if (ultimas.isEmpty()) continue;
                Usuario u = ultimas.get(0).getUsuario();
                int racha = calcularRachaConsecutiva(ultimas);
                long total = repo.countByUsuarioAndAcertadaTrue(u);
                eventPublisher.publishEvent(
                        new PrediccionResueltaEvent(u.getId(), u.getUsername(), total, racha));
            } catch (Exception e) {
                log.warn("Error publicando PrediccionResueltaEvent usuario={}: {}", usuarioId, e.getMessage());
            }
        }
    }

    /** Helper que reusa el usuario ya cargado en lugar de re-consultar. */
    private Usuario cargarUsuarioPorId(Long id) {
        return new Usuario() {{
            setId(id);
        }};
    }

    /**
     * Cuenta cuántas predicciones consecutivas a partir de la más reciente
     * son acertadas. Itera mientras acertada==true; corta en el primer fallo.
     */
    private int calcularRachaConsecutiva(List<Prediccion> ultimasDesc) {
        int racha = 0;
        for (Prediccion p : ultimasDesc) {
            if (Boolean.TRUE.equals(p.getAcertada())) racha++;
            else break;
        }
        return racha;
    }

    /** Leaderboard últimos N días, top K. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> leaderboard(int diasAtras, int limit) {
        LocalDateTime desde = LocalDateTime.now().minusDays(diasAtras);
        List<Object[]> filas = repo.leaderboardDesde(desde, PageRequest.of(0, Math.min(limit, 100)));
        List<Map<String, Object>> resultado = new ArrayList<>(filas.size());
        for (Object[] fila : filas) {
            Map<String, Object> entrada = new HashMap<>();
            entrada.put("usuarioId", fila[0]);
            entrada.put("username", fila[1]);
            entrada.put("aciertos", fila[2]);
            resultado.add(entrada);
        }
        return resultado;
    }
}
