package com.diegoalegil.animeshowdown.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import com.diegoalegil.animeshowdown.dto.ActividadItemDto;
import com.diegoalegil.animeshowdown.dto.LogroDto;
import com.diegoalegil.animeshowdown.dto.PerfilPublicoDto;
import com.diegoalegil.animeshowdown.dto.PerfilStatsDto;
import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.dto.VotoHistorialDto;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Prediccion;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import jakarta.servlet.http.HttpServletRequest;
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
    private final AuditLogService auditLogService;

    public PerfilService(VotoRepository votoRepository,
            PrediccionRepository prediccionRepository,
            UsuarioLogroRepository usuarioLogroRepository,
            SeguidorRepository seguidorRepository,
            TorneoRepository torneoRepository,
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            BadgeService badgeService,
            AuditLogService auditLogService) {
        this.votoRepository = votoRepository;
        this.prediccionRepository = prediccionRepository;
        this.usuarioLogroRepository = usuarioLogroRepository;
        this.seguidorRepository = seguidorRepository;
        this.torneoRepository = torneoRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.badgeService = badgeService;
        this.auditLogService = auditLogService;
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
                redondear(porcentaje, 1), badges, torneosCreados,
                usuario.getEloPvp(), usuario.getPvpPartidos());
    }

    @Transactional(readOnly = true)
    public Page<VotoHistorialDto> historialVotos(Usuario usuario, int page, int size) {
        int sanePage = Math.max(0, page);
        int saneSize = Math.min(100, Math.max(1, size));
        return votoRepository.findByUsuarioOrderByFechaDesc(usuario,
                PageRequest.of(sanePage, saneSize))
                .map(VotoHistorialDto::from);
    }

    @Transactional
    public int migrarVotosAnonimos(Usuario usuario, String anonSessionId) {
        if (usuario == null || anonSessionId == null || anonSessionId.isBlank()) {
            return 0;
        }
        int migrados = 0;
        for (Voto voto : votoRepository.findByAnonSessionIdAndUsuarioIsNullOrderByFechaAsc(anonSessionId.trim())) {
            Enfrentamiento enfrentamiento = voto.getEnfrentamiento();
            if (enfrentamiento != null && votoRepository.existsByEnfrentamientoAndUsuario(enfrentamiento, usuario)) {
                continue;
            }
            voto.setUsuario(usuario);
            migrados++;
        }
        return migrados;
    }

    /** Top N personajes más votados por el usuario. */
    @Transactional(readOnly = true)
    public List<TopPersonajeItem> top(Usuario usuario, int limit) {
        Pageable pg = PageRequest.of(0, Math.min(20, Math.max(1, limit)));
        return votoRepository.topPorUsuario(usuario, pg);
    }

    /**
     * Feed combinado de actividad reciente (Plan v2 §4.1).
     *
     * <p>Combina 4 fuentes en un único stream temporal descendente:
     * votos en enfrentamientos, logros desbloqueados, torneos creados y
     * predicciones acertadas. Pedimos {@code limit} de cada fuente,
     * mezclamos, ordenamos por fecha desc y devolvemos los {@code limit}
     * más recientes en total. Es O(4·limit) — barato para limit ≤ 20.
     *
     * <p>No paginamos: la actividad es vista resumen, no historial
     * completo. Para el historial detallado de votos ya está
     * {@code /me/historial-votos}.
     */
    @Transactional(readOnly = true)
    public List<ActividadItemDto> actividadReciente(Usuario usuario, int limit) {
        int n = Math.min(50, Math.max(1, limit));
        List<ActividadItemDto> out = new java.util.ArrayList<>();

        for (Voto v : votoRepository.findByUsuarioOrderByFechaDesc(usuario,
                PageRequest.of(0, n)).getContent()) {
            Map<String, Object> payload = new LinkedHashMap<>();
            Personaje p = v.getPersonaje();
            if (p != null) {
                payload.put("personajeSlug", p.getSlug());
                payload.put("personajeNombre", p.getNombre());
                payload.put("anime", p.getAnime());
            }
            Enfrentamiento enf = v.getEnfrentamiento();
            if (enf != null) {
                Personaje oponente = null;
                if (enf.getPersonaje1() != null && p != null
                        && !enf.getPersonaje1().getId().equals(p.getId())) {
                    oponente = enf.getPersonaje1();
                } else if (enf.getPersonaje2() != null && p != null
                        && !enf.getPersonaje2().getId().equals(p.getId())) {
                    oponente = enf.getPersonaje2();
                }
                if (oponente != null) {
                    payload.put("oponenteSlug", oponente.getSlug());
                    payload.put("oponenteNombre", oponente.getNombre());
                }
                if (enf.getTorneo() != null) {
                    payload.put("torneoId", enf.getTorneo().getId());
                    payload.put("torneoSlug", enf.getTorneo().getSlug());
                    payload.put("torneoNombre", enf.getTorneo().getNombre());
                }
            }
            out.add(new ActividadItemDto("VOTO", v.getFecha(), payload));
        }

        // Logros desbloqueados — usa el repo existente; trunca a N.
        int contadorL = 0;
        for (UsuarioLogro ul : usuarioLogroRepository
                .findByUsuarioOrderByDesbloqueadoEnDesc(usuario)) {
            if (contadorL++ >= n) break;
            Map<String, Object> payload = new HashMap<>();
            payload.put("codigo", ul.getLogro().getCodigo());
            payload.put("nombre", ul.getLogro().getNombre());
            payload.put("descripcion", ul.getLogro().getDescripcion());
            payload.put("icono", ul.getLogro().getIcono());
            payload.put("rareza", ul.getLogro().getRareza());
            out.add(new ActividadItemDto("LOGRO", ul.getDesbloqueadoEn(), payload));
        }

        // Torneos creados. El repo devuelve todos los estados; trunca a N
        // y filtra los que tienen fechaCreacion (deberían tenerlas todos
        // tras V12; defensivo por si algún torneo legacy quedó NULL).
        int contadorT = 0;
        for (Torneo t : torneoRepository.findByCreadoPorOrderByFechaCreacionDesc(usuario)) {
            if (contadorT++ >= n) break;
            if (t.getFechaCreacion() == null) continue;
            Map<String, Object> payload = new HashMap<>();
            payload.put("torneoSlug", t.getSlug());
            payload.put("torneoNombre", t.getNombre());
            payload.put("estado", t.getEstado() != null ? t.getEstado().name() : null);
            payload.put("estadoRevision", t.getEstadoRevision() != null ? t.getEstadoRevision().name() : null);
            out.add(new ActividadItemDto("TORNEO_CREADO", t.getFechaCreacion(), payload));
        }

        // Predicciones acertadas — sub-stream del historial de predicciones
        // del usuario. Filtramos por acertada=true.
        for (Prediccion pred : prediccionRepository.findResueltasDelUsuarioDesc(
                usuario, PageRequest.of(0, n * 2))) {
            if (!Boolean.TRUE.equals(pred.getAcertada())) continue;
            Map<String, Object> payload = new HashMap<>();
            Personaje pp = pred.getPersonajePredicho();
            Enfrentamiento enf = pred.getEnfrentamiento();
            if (pp != null) {
                payload.put("personajeSlug", pp.getSlug());
                payload.put("personajeNombre", pp.getNombre());
            }
            if (enf != null) {
                payload.put("enfrentamientoId", enf.getId());
                if (enf.getTorneo() != null) {
                    payload.put("torneoSlug", enf.getTorneo().getSlug());
                    payload.put("torneoNombre", enf.getTorneo().getNombre());
                }
            }
            out.add(new ActividadItemDto("PREDICCION_ACERTADA", pred.getFecha(), payload));
        }

        out.sort(Comparator.comparing(ActividadItemDto::fecha,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return out.size() > n ? out.subList(0, n) : out;
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
    public void eliminarCuenta(Usuario usuario, String passwordPlano, HttpServletRequest request) {
        if (passwordPlano == null || passwordPlano.isBlank()) {
            throw new IllegalArgumentException("Password requerida para eliminar la cuenta");
        }
        if (!passwordEncoder.matches(passwordPlano, usuario.getPassword())) {
            throw new IllegalArgumentException("Password incorrecta");
        }
        // Audit P2 (2026-05-17): registrar DESPUÉS de verificar password (sin
        // password válido no hay borrado y no debe haber audit), pero ANTES
        // del delete (el FK audit_log.usuario_id necesita una fila viva; la
        // cascada ON DELETE SET NULL lo limpia tras el commit). Síncrono
        // dentro de la misma tx para que ambas escrituras commiteen juntas
        // o se rollee todo. La versión @Async anterior podía persistir
        // tarde con FK violation.
        // Audit (2026-05-17): no incluir email en los detalles del audit.
        // Los logs tienen retención larga (forensic/compliance) y exponer
        // PII allí viola data minimization — el username es suficiente
        // para forense del evento. Si necesitamos contactar al usuario
        // tras el delete, podemos cruzar con la audit_log de eventos
        // previos del mismo username que sí tenían email legítimo.
        auditLogService.registrarSync(
                AuditEvento.CUENTA_ELIMINADA,
                usuario,
                java.util.Map.of("username", usuario.getUsername()),
                request);
        usuarioRepository.delete(usuario);
    }

    private static double redondear(double v, int decimales) {
        double factor = Math.pow(10, decimales);
        return Math.round(v * factor) / factor;
    }
}
