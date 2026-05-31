package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Cierra la ronda activa del bracket y propaga los ganadores a la ronda
 * siguiente, cumpliendo el contrato que prometía el comentario de
 * {@link BracketService} sobre el "BracketAvanceScheduler" que nunca se
 * implementó (nota).
 *
 * <p>Antes del fix, las rondas 2+ del bracket se creaban con slots vacíos
 * y no se rellenaban nunca. {@code TorneoService.finalizar} saltaba esos
 * slots y marcaba el torneo como FINISHED igual — un torneo de 8 o 16
 * podía "terminar" sin haber jugado semifinal/final, con
 * {@code ganadorPersonaje} apuntando al ganador de la primera ronda como
 * si fuera el campeón.
 *
 * <p>Diseño:
 * <ul>
 *   <li>{@link #cerrarRondaYAvanzar(Torneo)} cierra UNA ronda. Identifica
 *       la primera ronda con matches "pendientes" (con ambos personajes
 *       asignados pero sin ganador), calcula ganadores por count de votos
 *       y los propaga al match destino de la ronda siguiente. Si era la
 *       última ronda, marca el torneo como {@code FINISHED} y deja
 *       {@code ganadorPersonaje} apuntando al ganador real.</li>
 *   <li>{@link #cerrarTodasLasRondas(Torneo)} aplica
 *       {@link #cerrarRondaYAvanzar} en cascada hasta que el torneo
 *       quede FINISHED o no haya progreso (empate o votos faltantes).
 *       Usado por el endpoint {@code /finalizar}.</li>
 * </ul>
 *
 * <p>Mapping ronda R → R+1 (mismo que documenta {@link BracketService}):
 * para un match con índice 0-based {@code i} dentro de su ronda, el ganador
 * va al match {@code i/2} de la ronda siguiente. Si {@code i} es par →
 * slot personaje1; si es impar → slot personaje2. Preserva el orden visual
 * del bracket (top contra top, bottom contra bottom).
 */
@Service
public class BracketAdvanceService {

    private static final Logger log = LoggerFactory.getLogger(BracketAdvanceService.class);

    public enum Resultado {
        /** Una ronda se cerró y se propagaron los ganadores a la siguiente. */
        AVANZADA,
        /** Era la última ronda; el torneo queda FINISHED con ganador asignado. */
        TORNEO_FINALIZADO,
        /** No hay ronda completa que cerrar (faltan votos, hay empates, o rondas previas sin avanzar). */
        SIN_CAMBIOS
    }

    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;
    private final TorneoRepository torneoRepository;

    // Self-injection vía proxy para que cerrarTodasLasRondas pueda invocar
    // cerrarRondaYAvanzar(REQUIRES_NEW) y obtener una tx separada por ronda.
    // Sin esto, this.cerrarRondaYAvanzar es invocación directa al método del
    // bean concreto (no del proxy) y Spring no aplica @Transactional — todo
    // corre en una sola tx, y si el último cerrarRondaYAvanzar lanza, los
    // avances previos también rolean.
    @Autowired
    @Lazy
    private BracketAdvanceService self;

    public BracketAdvanceService(EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository,
            TorneoRepository torneoRepository) {
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
        this.torneoRepository = torneoRepository;
    }

    /**
     * Identifica la primera ronda "lista para cerrarse" (todos sus matches
     * tienen ambos personajes asignados y al menos un voto que permita
     * decidir ganador no empatado) y la cierra. Si la cierra, propaga los
     * ganadores a la ronda siguiente o, si era la última, finaliza el torneo.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Resultado cerrarRondaYAvanzar(Torneo torneo) {
        return cerrarRondaYAvanzarInternal(torneo, true);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Resultado cerrarRondaIntermediaYAvanzar(Torneo torneo) {
        return cerrarRondaYAvanzarInternal(torneo, false);
    }

    private Resultado cerrarRondaYAvanzarInternal(Torneo torneo, boolean permitirFinalizar) {
        List<Enfrentamiento> todos = enfrentamientoRepository
                .findByTorneoForUpdateOrderByRondaAscIdAsc(torneo);
        if (todos.isEmpty()) {
            return Resultado.SIN_CAMBIOS;
        }

        // Agrupar por ronda preservando orden (TreeMap = ordenado por key ASC).
        Map<Integer, List<Enfrentamiento>> porRonda = new TreeMap<>();
        for (Enfrentamiento e : todos) {
            porRonda.computeIfAbsent(e.getRonda() == null ? 1 : e.getRonda(), r -> new ArrayList<>()).add(e);
        }
        int maxRonda = porRonda.keySet().stream().max(Integer::compareTo).orElse(1);

        // Primera ronda con matches "pendientes" (sin ganador asignado).
        Integer rondaACerrar = null;
        for (Map.Entry<Integer, List<Enfrentamiento>> entry : porRonda.entrySet()) {
            boolean algunSinGanador = entry.getValue().stream().anyMatch(e -> e.getGanador() == null);
            if (algunSinGanador) {
                rondaACerrar = entry.getKey();
                break;
            }
        }
        if (rondaACerrar == null) {
            // Todas las rondas tienen ganador; comprueba si el torneo necesita
            // marcarse FINISHED (caso de borde: alguien resolvió manualmente).
            return finalizarSiCorresponde(torneo, porRonda.get(maxRonda));
        }

        List<Enfrentamiento> matches = porRonda.get(rondaACerrar);

        // Pre-checks: todos con ambos personajes, todos con votos suficientes
        // para decidir (no empates).
        for (Enfrentamiento m : matches) {
            if (m.getPersonaje1() == null || m.getPersonaje2() == null) {
                log.debug("Torneo {} ronda {}: match {} sin personajes — no se puede cerrar",
                        torneo.getSlug(), rondaACerrar, m.getId());
                return Resultado.SIN_CAMBIOS;
            }
        }

        // two-phase commit lógico. Antes este loop
        // hacía setGanador + save match a match; si un match POSTERIOR
        // empataba y retornaba SIN_CAMBIOS, los matches previos ya quedaban
        // mutados en BBDD (la tx REQUIRES_NEW commitea cada paso). Resultado:
        // ronda 1/2 cerrada y ronda 1/2 abierta, estado inconsistente que
        // el siguiente cerrarRondaYAvanzar interpretaba mal. Fase 1: calcula
        // todos los ganadores sin tocar entidades. Si algún empate, return
        // SIN_CAMBIOS sin escribir nada. Fase 2: persistir ahora que sabemos
        // que toda la ronda se puede cerrar atómicamente dentro de esta tx.
        List<Personaje> ganadores = new ArrayList<>(matches.size());
        for (Enfrentamiento m : matches) {
            double v1 = votoRepository.scoreByEnfrentamientoAndPersonaje(m, m.getPersonaje1());
            double v2 = votoRepository.scoreByEnfrentamientoAndPersonaje(m, m.getPersonaje2());
            if (Double.compare(v1 + v2, 0.0) == 0) {
                log.debug("Torneo {} ronda {}: match {} sin votos; no se cierra ronda",
                        torneo.getSlug(), rondaACerrar, m.getId());
                return Resultado.SIN_CAMBIOS;
            }
            if (Double.compare(v1, v2) == 0) {
                Personaje desempate = resolverEmpate(m);
                log.info("Torneo {} ronda {}: match {} empatado ({}-{}); desempate={} por ranking/id",
                        torneo.getSlug(), rondaACerrar, m.getId(), v1, v2, desempate.getSlug());
                ganadores.add(desempate);
            } else {
                ganadores.add(v1 > v2 ? m.getPersonaje1() : m.getPersonaje2());
            }
        }

        // sanity check del bracket malformado ANTES de
        // persistir cualquier ganador. Si no es la última ronda y la
        // siguiente no existe o tiene tamaño incorrecto, abortar sin
        // tocar BBDD. Antes el check estaba después de los setGanador +
        // save, así que un bracket roto dejaba la ronda actual cerrada
        // pero la siguiente nunca poblada — estado parcial irrecuperable.
        List<Enfrentamiento> siguiente = null;
        if (!rondaACerrar.equals(maxRonda)) {
            siguiente = porRonda.get(rondaACerrar + 1);
            if (siguiente == null || siguiente.size() != matches.size() / 2) {
                log.error("Torneo {} ronda {}→{}: tamaños inconsistentes ({} vs esperados {}). Abortando sin escribir.",
                        torneo.getSlug(), rondaACerrar, rondaACerrar + 1,
                        siguiente == null ? 0 : siguiente.size(), matches.size() / 2);
                return Resultado.SIN_CAMBIOS;
            }
        }
        if (rondaACerrar.equals(maxRonda) && !permitirFinalizar) {
            return Resultado.SIN_CAMBIOS;
        }

        // Validado: ahora sí, persistir ganadores de la ronda.
        for (int i = 0; i < matches.size(); i++) {
            Enfrentamiento m = matches.get(i);
            m.setGanador(ganadores.get(i));
            enfrentamientoRepository.save(m);
        }

        // ¿Era la última ronda? Marca FINISHED.
        if (rondaACerrar.equals(maxRonda)) {
            torneo.setGanadorPersonaje(matches.get(0).getGanador());
            torneo.setEstado(EstadoTorneo.FINISHED);
            torneo.setFechaFinalizacion(java.time.LocalDateTime.now());
            torneoRepository.save(torneo);
            log.info("Torneo {} FINALIZADO en ronda {} — ganador={}",
                    torneo.getSlug(), rondaACerrar, matches.get(0).getGanador().getSlug());
            return Resultado.TORNEO_FINALIZADO;
        }

        // Propaga ganadores a la ronda siguiente (ya validada arriba).
        for (int i = 0; i < matches.size(); i++) {
            Enfrentamiento src = matches.get(i);
            Enfrentamiento dst = siguiente.get(i / 2);
            Personaje ganador = src.getGanador();
            if (i % 2 == 0) {
                dst.setPersonaje1(ganador);
            } else {
                dst.setPersonaje2(ganador);
            }
            enfrentamientoRepository.save(dst);
        }
        log.info("Torneo {} ronda {} cerrada; propagados {} ganadores a ronda {}",
                torneo.getSlug(), rondaACerrar, matches.size(), rondaACerrar + 1);
        return Resultado.AVANZADA;
    }

    /**
     * Aplica {@link #cerrarRondaYAvanzar} en cascada hasta que el torneo
     * quede FINISHED o no haya más progreso (empate/votos faltantes).
     *
     * <p>Sin {@code @Transactional} a propósito: invoca {@link #cerrarRondaYAvanzar}
     * vía el proxy ({@code self.}) para que CADA cierre de ronda commitee en
     * su propia tx REQUIRES_NEW. Si una ronda intermedia avanza con éxito
     * pero la última no puede cerrarse (empate/votos faltantes), el progreso
     * realizado queda persistido en BBDD en lugar de rolear todo.
     *
     * <p>El límite cubre hasta 256 participantes (log2(256)+1 de margen). Sigue
     * siendo un safeguard contra bucles infinitos. No derivamos del
     * tamaño real del bracket por query para evitar tocar la cache L1
     * de Hibernate antes de las tx REQUIRES_NEW (causaba race con
     * listeners async de predicciones).
     */
    public Resultado cerrarTodasLasRondas(Torneo torneo) {
        final int MAX_RONDAS = 9;
        Resultado ultima = Resultado.SIN_CAMBIOS;
        for (int i = 0; i < MAX_RONDAS; i++) {
            Resultado r = self.cerrarRondaYAvanzar(torneo);
            if (r == Resultado.TORNEO_FINALIZADO) return r;
            if (r == Resultado.SIN_CAMBIOS) return ultima == Resultado.AVANZADA ? ultima : r;
            ultima = r;
        }
        return ultima;
    }

    public Resultado cerrarRondasIntermedias(Torneo torneo) {
        final int MAX_RONDAS = 9;
        Resultado ultima = Resultado.SIN_CAMBIOS;
        for (int i = 0; i < MAX_RONDAS; i++) {
            Resultado r = self.cerrarRondaIntermediaYAvanzar(torneo);
            if (r == Resultado.SIN_CAMBIOS) return ultima == Resultado.AVANZADA ? ultima : r;
            ultima = r;
        }
        return ultima;
    }

    private Resultado finalizarSiCorresponde(Torneo torneo, List<Enfrentamiento> ultimaRonda) {
        if (torneo.getEstado() == EstadoTorneo.FINISHED) {
            return Resultado.SIN_CAMBIOS;
        }
        // Toda ronda tiene ganador y la última también — marca FINISHED.
        Enfrentamiento finalMatch = ultimaRonda.get(0);
        if (finalMatch.getGanador() != null) {
            torneo.setGanadorPersonaje(finalMatch.getGanador());
            torneo.setEstado(EstadoTorneo.FINISHED);
            torneo.setFechaFinalizacion(java.time.LocalDateTime.now());
            torneoRepository.save(torneo);
            return Resultado.TORNEO_FINALIZADO;
        }
        return Resultado.SIN_CAMBIOS;
    }

    private Personaje resolverEmpate(Enfrentamiento m) {
        Personaje p1 = m.getPersonaje1();
        Personaje p2 = m.getPersonaje2();
        double global1 = votoRepository.sumaPesoByPersonajeId(p1.getId());
        double global2 = votoRepository.sumaPesoByPersonajeId(p2.getId());
        int cmp = Double.compare(global1, global2);
        if (cmp > 0) return p1;
        if (cmp < 0) return p2;
        return p1.getId() <= p2.getId() ? p1 : p2;
    }
}
