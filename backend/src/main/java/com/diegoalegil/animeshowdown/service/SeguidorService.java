package com.diegoalegil.animeshowdown.service;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Sistema de friends / follow asimétrico.
 *
 * <p>Operaciones:
 * <ul>
 *   <li>{@link #seguir(Usuario, Long)} — idempotente: si ya sigue, no-op.
 *       Dispara notificación al seguido (SEGUIDOR_NUEVO).</li>
 *   <li>{@link #dejarDeSeguir(Usuario, Long)} — DELETE de la relación.</li>
 *   <li>{@link #listarSeguidos(Usuario)} y
 *       {@link #listarSeguidores(Usuario)} — para perfiles públicos.</li>
 * </ul>
 */
@Service
public class SeguidorService {

    private static final Logger log = LoggerFactory.getLogger(SeguidorService.class);

    private final SeguidorRepository repo;
    private final UsuarioRepository usuarioRepository;
    private final NotificacionService notificacionService;

    public SeguidorService(SeguidorRepository repo,
            UsuarioRepository usuarioRepository,
            NotificacionService notificacionService) {
        this.repo = repo;
        this.usuarioRepository = usuarioRepository;
        this.notificacionService = notificacionService;
    }

    @Transactional
    public boolean seguir(Usuario seguidor, Long seguidoId) {
        if (seguidor == null || seguidoId == null) return false;
        if (seguidor.getId().equals(seguidoId)) {
            throw new IllegalArgumentException("No puedes seguirte a ti mismo");
        }
        Optional<Usuario> seguidoOpt = usuarioRepository.findById(seguidoId);
        if (seguidoOpt.isEmpty()) {
            throw new IllegalArgumentException("Usuario a seguir no encontrado");
        }
        // Insert atómico idempotente (ON CONFLICT DO NOTHING) en vez del mutex global
        // + existsBy + insert: la PK (seguidor_id, seguido_id) arbitra la carrera, así
        // que ya no serializamos TODOS los follows de la app sobre una única fila.
        if (repo.insertarSiFalta(seguidor.getId(), seguidoId) == 0) {
            return false; // Ya lo sigue
        }
        Usuario seguido = seguidoOpt.get();
        log.info("Follow: {} → {}", seguidor.getUsername(), seguido.getUsername());

        // 13 + §4.5: notifica al seguido. Best-effort.
        try {
            notificacionService.crear(
                    seguido,
                    NotificacionTipo.SEGUIDOR_NUEVO,
                    "Tienes un nuevo seguidor",
                    seguidor.getUsername() + " ha empezado a seguirte.",
                    "{\"seguidorUsername\":\"" + seguidor.getUsername() + "\"}");
        } catch (Exception e) {
            log.warn("Notificación SEGUIDOR_NUEVO falló: {}", e.getMessage());
        }
        return true;
    }

    @Transactional
    public boolean dejarDeSeguir(Usuario seguidor, Long seguidoId) {
        if (seguidor == null || seguidoId == null) return false;
        // deleteRelacion es idempotente (DELETE WHERE → 0/1 filas): no necesita lock.
        int n = repo.deleteRelacion(seguidor.getId(), seguidoId);
        return n > 0;
    }

    @Transactional(readOnly = true)
    public List<Usuario> listarSeguidos(Usuario usuario) {
        return repo.seguidosDe(usuario);
    }

    @Transactional(readOnly = true)
    public List<Usuario> listarSeguidores(Usuario usuario) {
        return repo.seguidoresDe(usuario);
    }

    @Transactional(readOnly = true)
    public long countSeguidos(Usuario usuario) {
        return repo.countByIdSeguidorId(usuario.getId());
    }

    @Transactional(readOnly = true)
    public long countSeguidores(Usuario usuario) {
        return repo.countByIdSeguidoId(usuario.getId());
    }

    @Transactional(readOnly = true)
    public boolean estaSiguiendo(Usuario seguidor, Long seguidoId) {
        if (seguidor == null) return false;
        return repo.existsByIdSeguidorIdAndIdSeguidoId(seguidor.getId(), seguidoId);
    }
}
