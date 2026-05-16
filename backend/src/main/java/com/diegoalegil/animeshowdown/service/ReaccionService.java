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
import com.diegoalegil.animeshowdown.repository.ReaccionRepository;

/**
 * Lógica de reactions emoji sobre personajes / torneos / matches (Plan v2 §4.3).
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

    public ReaccionService(ReaccionRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public Optional<Reaccion> aplicar(Usuario usuario, ReaccionTargetType targetType,
            Long targetId, ReaccionTipo tipo) {
        if (usuario == null || targetType == null || targetId == null || tipo == null) {
            return Optional.empty();
        }
        Optional<Reaccion> existente = repo.findByUsuarioAndTargetTypeAndTargetId(
                usuario, targetType, targetId);

        if (existente.isPresent()) {
            Reaccion r = existente.get();
            if (r.getTipo() == tipo) {
                // Toggle off: clica el mismo emoji que ya tiene → borra.
                repo.delete(r);
                log.debug("Reaccion toggle-off: usuario={} target={}:{} tipo={}",
                        usuario.getUsername(), targetType, targetId, tipo);
                return Optional.empty();
            }
            // Cambia el tipo. setTipo actualiza también la fecha.
            r.setTipo(tipo);
            Reaccion guardada = repo.save(r);
            log.debug("Reaccion swap: usuario={} target={}:{} tipo={}",
                    usuario.getUsername(), targetType, targetId, tipo);
            return Optional.of(guardada);
        }

        Reaccion nueva = new Reaccion(usuario, tipo, targetType, targetId);
        Reaccion guardada = repo.save(nueva);
        log.debug("Reaccion nueva: usuario={} target={}:{} tipo={}",
                usuario.getUsername(), targetType, targetId, tipo);
        return Optional.of(guardada);
    }

    /**
     * Devuelve el resumen del target: counts por tipo + mi reaction.
     * usuario puede ser null (anónimo) — en ese caso miReaccion=null.
     */
    @Transactional(readOnly = true)
    public ReaccionesResumen resumen(ReaccionTargetType targetType, Long targetId, Usuario usuario) {
        Map<ReaccionTipo, Long> counts = new EnumMap<>(ReaccionTipo.class);
        for (ReaccionTipo t : ReaccionTipo.values()) counts.put(t, 0L);
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
