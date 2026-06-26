package com.diegoalegil.animeshowdown.service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.ReaccionesResumen;
import com.diegoalegil.animeshowdown.model.Reaccion;
import com.diegoalegil.animeshowdown.model.ReaccionTargetType;
import com.diegoalegil.animeshowdown.model.ReaccionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.ReaccionRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

/**
 * Lógica de reactions emoji sobre personajes / torneos / matches.
 *
 * <p>Comportamiento del {@link #aplicar(Usuario, ReaccionTargetType, Long, ReaccionTipo)}
 * según el estado previo del par (usuario, target):
 * <ul>
 *   <li>Si NO tenía reaction → crea con el tipo dado.</li>
 *   <li>Si tenía OTRA reaction → cambia el tipo (UPDATE).</li>
 *   <li>Si tenía la MISMA reaction → toggle off (DELETE).</li>
 * </ul>
 * Devuelve la reaction resultante (null si se borró).
 */
@Service
public class ReaccionService {

    private static final Logger log = LoggerFactory.getLogger(ReaccionService.class);

    private final ReaccionRepository repo;
    private final PersonajeRepository personajeRepository;
    private final TorneoRepository torneoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;

    public ReaccionService(ReaccionRepository repo,
            PersonajeRepository personajeRepository,
            TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository) {
        this.repo = repo;
        this.personajeRepository = personajeRepository;
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
    }

    @Transactional
    public Optional<Reaccion> aplicar(Usuario usuario, ReaccionTargetType targetType,
            Long targetId, ReaccionTipo tipo) {
        if (usuario == null || targetType == null || targetId == null || tipo == null) {
            return Optional.empty();
        }
        // antes el service persistía sin validar que
        // el target existiera. Un cliente directo podía mandar
        // targetType=PERSONAJE + targetId=999999 y la reacción se guardaba
        // huérfana — no entraba en ningún resumen real pero contaba como
        // entrada en la tabla y podía contaminar los counters por tipo.
        // Ahora rechazamos con IllegalArgumentException que el controller
        // traduce a 400.
        if (!existeTarget(targetType, targetId)) {
            throw new IllegalArgumentException(
                    "Target inexistente: " + targetType + ":" + targetId);
        }
        Optional<Reaccion> existente = repo.findByUsuarioAndTargetTypeAndTargetId(
                usuario, targetType, targetId);

        if (existente.isPresent()) {
            Reaccion r = existente.get();
            if (r.getTipo() == tipo) {
                // Toggle off: clica el mismo emoji que ya tiene → borra.
                repo.delete(r);
                repo.flush();
                log.debug("Reaccion toggle-off: usuario={} target={}:{} tipo={}",
                        usuario.getUsername(), targetType, targetId, tipo);
                return Optional.empty();
            }
            // Cambia el tipo. setTipo actualiza también la fecha.
            r.setTipo(tipo);
            Reaccion guardada = repo.saveAndFlush(r);
            log.debug("Reaccion swap: usuario={} target={}:{} tipo={}",
                    usuario.getUsername(), targetType, targetId, tipo);
            return Optional.of(guardada);
        }

        // Nueva reacción: insert atómico idempotente (ON CONFLICT DO NOTHING sobre
        // uk_reacciones_par) en vez del mutex global + insert. Si una petición
        // concurrente del MISMO (usuario, target) la creó a la vez (0 filas), re-leemos
        // y reconciliamos el tipo. El ON CONFLICT no lanza → no aborta la tx (a
        // diferencia de un insert plano + catch).
        repo.insertarSiFalta(usuario.getId(), tipo.name(), targetType.name(), targetId);
        Reaccion r = repo.findByUsuarioAndTargetTypeAndTargetId(usuario, targetType, targetId)
                .orElseThrow(() -> new IllegalStateException(
                        "Reacción no encontrada tras insertarSiFalta: " + targetType + ":" + targetId));
        if (r.getTipo() != tipo) {
            r.setTipo(tipo);
            r = repo.saveAndFlush(r);
        }
        log.debug("Reaccion nueva: usuario={} target={}:{} tipo={}",
                usuario.getUsername(), targetType, targetId, tipo);
        return Optional.of(r);
    }

    private boolean existeTarget(ReaccionTargetType type, Long id) {
        return switch (type) {
            case PERSONAJE -> personajeRepository.existsById(id);
            // un torneo PENDIENTE o RECHAZADO no debe
            // considerarse "existente" para el público — eso filtraba metadata
            // de torneos en cola de moderación. Igualmente para MATCH: si su
            // torneo está oculto, el match tampoco existe a efectos del API
            // público.
            case TORNEO -> torneoRepository.findById(id)
                    .map(t -> t.getEstadoRevision() != com.diegoalegil.animeshowdown.model.EstadoRevision.PENDIENTE
                            && t.getEstadoRevision() != com.diegoalegil.animeshowdown.model.EstadoRevision.RECHAZADO)
                    .orElse(false);
            case MATCH -> enfrentamientoRepository.findById(id)
                    .map(e -> {
                        var rev = e.getTorneo().getEstadoRevision();
                        return rev != com.diegoalegil.animeshowdown.model.EstadoRevision.PENDIENTE
                                && rev != com.diegoalegil.animeshowdown.model.EstadoRevision.RECHAZADO;
                    })
                    .orElse(false);
        };
    }

    /**
     * Devuelve el resumen del target: counts por tipo + mi reaction.
     * usuario puede ser null (anónimo) — en ese caso miReaccion=null.
     *
     * <p>valida visibilidad del target antes de
     * agregar counts. Antes el GET retornaba conteos para cualquier
     * (targetType, targetId), incluyendo torneos PENDIENTE/RECHAZADO
     * (filtraba metadata) o ids inexistentes (revela cardinalidad de la
     * tabla). Mismo trato 404-equivalente que el POST y el resto de APIs
     * de visibilidad: si el target no existe o está oculto, devuelve un
     * resumen vacío sin tocar el repo de counts.
     */
    @Transactional(readOnly = true)
    public ReaccionesResumen resumen(ReaccionTargetType targetType, Long targetId, Usuario usuario) {
        Map<ReaccionTipo, Long> counts = new EnumMap<>(ReaccionTipo.class);
        for (ReaccionTipo t : ReaccionTipo.values()) counts.put(t, 0L);
        if (targetType == null || targetId == null || !existeTarget(targetType, targetId)) {
            return new ReaccionesResumen(counts, null, 0);
        }
        long total = 0;
        List<Object[]> filas = repo.contarPorTipo(targetType, targetId);
        for (Object[] fila : filas) {
            ReaccionTipo t = (ReaccionTipo) fila[0];
            Long c = (Long) fila[1];
            counts.put(t, c);
            total += c;
        }
        ReaccionTipo mia = null;
        if (usuario != null) {
            mia = repo.findByUsuarioAndTargetTypeAndTargetId(usuario, targetType, targetId)
                    .map(Reaccion::getTipo)
                    .orElse(null);
        }
        return new ReaccionesResumen(counts, mia, total);
    }
}
