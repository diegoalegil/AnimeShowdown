package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.LogroDto;
import com.diegoalegil.animeshowdown.dto.PerfilPublicoDto;
import com.diegoalegil.animeshowdown.dto.PerfilStatsDto;
import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.dto.VotoHistorialDto;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Stats agregadas del usuario para el perfil (Plan v2 §4.1).
 *
 * <p>Todos los métodos {@code @Transactional(readOnly = true)} para que el
 * mapeo a DTO con accesos lazy (Voto.enfrentamiento → personaje1/2, torneo)
 * suceda dentro de la session de Hibernate — mismo patrón que en
 * BadgeService y PrediccionService para evitar LazyInitException.
 */
@Service
public class PerfilService {

    private final VotoRepository votoRepository;
    private final PrediccionRepository prediccionRepository;
    private final UsuarioLogroRepository usuarioLogroRepository;
    private final SeguidorRepository seguidorRepository;
    private final TorneoRepository torneoRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final BadgeService badgeService;

    public PerfilService(VotoRepository votoRepository,
            PrediccionRepository prediccionRepository,
            UsuarioLogroRepository usuarioLogroRepository,
            SeguidorRepository seguidorRepository,
            TorneoRepository torneoRepository,
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            BadgeService badgeService) {
        this.votoRepository = votoRepository;
        this.prediccionRepository = prediccionRepository;
        this.usuarioLogroRepository = usuarioLogroRepository;
        this.seguidorRepository = seguidorRepository;
        this.torneoRepository = torneoRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.badgeService = badgeService;
    }

    /**
     * Vista pública agregada (Plan v2 §4.5). Junta stats + top + logros
     * desbloqueados + counts de follow en una sola transacción para que
     * el mapeo lazy de UsuarioLogro.logro suceda con session viva.
     */
    @Transactional(readOnly = true)
    public PerfilPublicoDto perfilPublico(Usuario duenyo, Usuario caller, int topLimit) {
        PerfilStatsDto statsDto = stats(duenyo);
        List<TopPersonajeItem> topItems = top(duenyo, topLimit);
        // Frontend pinta catálogo completo con locked, así que devolvemos
        // los 14 con desbloqueadoEn poblado en los que el user tiene.
        List<LogroDto> logrosDesbloqueados = badgeService
                .listarCatalogoConDesbloqueos(duenyo);
        long countSeguidores = seguidorRepository.countByIdSeguidoId(duenyo.getId());
        long countSeguidos = seguidorRepository.countByIdSeguidorId(duenyo.getId());

        boolean esMismo = caller != null && caller.getId().equals(duenyo.getId());
        Boolean siguiendo = null;
        if (caller != null && !esMismo) {
            siguiendo = seguidorRepository.existsByIdSeguidorIdAndIdSeguidoId(
                    caller.getId(), duenyo.getId());
        }
        return new PerfilPublicoDto(
                duenyo.getId(),
                duenyo.getUsername(),
                duenyo.getAvatarUrl(),
                countSeguidores,
                countSeguidos,
                siguiendo,
                esMismo,
                statsDto,
                topItems,
                logrosDesbloqueados);
    }

    @Transactional(readOnly = true)
    public PerfilStatsDto stats(Usuario usuario) {
        long votosTotales = votoRepository.countByUsuario(usuario);
        long prediccionesAcertadas = prediccionRepository.countByUsuarioAndAcertadaTrue(usuario);
        // Una pasada O(n) por todas las predicciones es aceptable porque el
        // count de predicciones por usuario es siempre pequeño (decenas).
        var todasMisPredicciones = prediccionRepository.findResueltasDelUsuarioDesc(
                usuario, PageRequest.of(0, 10_000));
        long prediccionesResueltas = todasMisPredicciones.size();
        // prediccionesTotales requiere el count de TODAS (resueltas + pendientes).
        // No tenemos un countByUsuario en PrediccionRepository — usamos una
        // aproximación: las resueltas + 0 pendientes en stats actuales (las
        // pendientes solo importan al user en el bracket activo, no aquí).
        // Si en el futuro queremos exactitud, añadir Prediccion.countByUsuario.
        long prediccionesTotales = prediccionesResueltas;
        double porcentaje = prediccionesResueltas == 0
                ? 0.0
                : (100.0 * prediccionesAcertadas) / prediccionesResueltas;
        long badges = usuarioLogroRepository.countByUsuario(usuario);
        long torneosCreados = torneoRepository.countByCreadoPor(usuario);
        return new PerfilStatsDto(votosTotales, prediccionesTotales,
                prediccionesAcertadas, prediccionesResueltas,
                redondear(porcentaje, 1), badges, torneosCreados);
    }

    @Transactional(readOnly = true)
    public Page<VotoHistorialDto> historialVotos(Usuario usuario, int page, int size) {
        int sanePage = Math.max(0, page);
        int saneSize = Math.min(100, Math.max(1, size));
        return votoRepository.findByUsuarioOrderByFechaDesc(usuario,
                PageRequest.of(sanePage, saneSize))
                .map(VotoHistorialDto::from);
    }

    /** Top N personajes más votados por el usuario. */
    @Transactional(readOnly = true)
    public List<TopPersonajeItem> top(Usuario usuario, int limit) {
        Pageable pg = PageRequest.of(0, Math.min(20, Math.max(1, limit)));
        List<Object[]> filas = votoRepository.topPorUsuario(usuario, pg);
        List<TopPersonajeItem> resultado = new ArrayList<>(filas.size());
        for (Object[] fila : filas) {
            Personaje p = (Personaje) fila[0];
            Long count = (Long) fila[1];
            resultado.add(new TopPersonajeItem(
                    p.getId(), p.getSlug(), p.getNombre(),
                    p.getImagenUrl(), p.getAnime(), count));
        }
        return resultado;
    }

    /**
     * Borra la cuenta del usuario (Plan v2 §4.1, GDPR right to erasure).
     *
     * <p>Verifica password antes de proceder. La cascada del schema
     * (V13) elimina datos derivados: refresh tokens, email verifications,
     * predicciones, logros, reacciones, notificaciones, follows, backup
     * codes 2FA. Los votos se anonimizan (SET NULL) para preservar el
     * agregado del ranking. Los torneos creados quedan con
     * created_by_user_id=NULL (preservar el bracket público).
     *
     * <p>Lanza {@link IllegalArgumentException} si la password no
     * coincide — el caller (controller) la traduce a 400.
     */
    @Transactional
    public void eliminarCuenta(Usuario usuario, String passwordPlano) {
        if (passwordPlano == null || passwordPlano.isBlank()) {
            throw new IllegalArgumentException("Password requerida para eliminar la cuenta");
        }
        if (!passwordEncoder.matches(passwordPlano, usuario.getPassword())) {
            throw new IllegalArgumentException("Password incorrecta");
        }
        usuarioRepository.delete(usuario);
        // El audit del evento CUENTA_ELIMINADA se hace en el controller
        // ANTES del delete (necesitamos el usuario aún vivo para el FK
        // audit_log.usuario_id; tras el delete pasa a NULL por SET NULL,
        // pero el detalle con username queda en el JSON).
    }

    private static double redondear(double v, int decimales) {
        double factor = Math.pow(10, decimales);
        return Math.round(v * factor) / factor;
    }
}
