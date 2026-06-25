package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.ActividadItemDto;
import com.diegoalegil.animeshowdown.dto.LogroDto;
import com.diegoalegil.animeshowdown.dto.PerfilPublicoDto;
import com.diegoalegil.animeshowdown.dto.PerfilStatsDto;
import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.dto.VotoHistorialDto;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.DueloLiveEstado;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Prediccion;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.DueloLiveRepository;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Stats agregadas del usuario para el perfil.
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
    private final DueloLiveRepository dueloLiveRepository;
    private final PasswordEncoder passwordEncoder;
    private final BadgeService badgeService;
    private final AuditLogService auditLogService;

    public PerfilService(VotoRepository votoRepository,
            PrediccionRepository prediccionRepository,
            UsuarioLogroRepository usuarioLogroRepository,
            SeguidorRepository seguidorRepository,
            TorneoRepository torneoRepository,
            UsuarioRepository usuarioRepository,
            DueloLiveRepository dueloLiveRepository,
            PasswordEncoder passwordEncoder,
            BadgeService badgeService,
            AuditLogService auditLogService) {
        this.votoRepository = votoRepository;
        this.prediccionRepository = prediccionRepository;
        this.usuarioLogroRepository = usuarioLogroRepository;
        this.seguidorRepository = seguidorRepository;
        this.torneoRepository = torneoRepository;
        this.usuarioRepository = usuarioRepository;
        this.dueloLiveRepository = dueloLiveRepository;
        this.passwordEncoder = passwordEncoder;
        this.badgeService = badgeService;
        this.auditLogService = auditLogService;
    }

    /**
     * Vista pública agregada. Junta stats + top + logros
     * desbloqueados + counts de follow en una sola transacción para que
     * el mapeo lazy de UsuarioLogro.logro suceda con session viva.
     */
    @Transactional(readOnly = true)
    public PerfilPublicoDto perfilPublico(Usuario duenyo, Usuario caller, int topLimit) {
        PerfilStatsDto statsDto = stats(duenyo);
        List<TopPersonajeItem> topItems = top(duenyo, topLimit);
        // Frontend pinta catálogo completo con locked, así que devolvemos
        // el catálogo con desbloqueadoEn poblado cuando el usuario ya lo tiene.
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
                duenyo.getMarcoAvatar(),
                duenyo.getBannerUrl(),
                duenyo.getBio(),
                duenyo.getFechaRegistro(),
                countSeguidores,
                countSeguidos,
                siguiendo,
                esMismo,
                statsDto,
                topItems,
                logrosDesbloqueados);
    }

    /** Caracteres máximos de bio tras sanitizar. Espejo de V34 (VARCHAR 240). */
    static final int BIO_MAX = 240;

    /**
     * Edita la bio del usuario autenticado (B7 §1a). Sanitiza a texto plano
     * (strip de etiquetas HTML/scripts + colapsa espacios) y la trunca a
     * {@link #BIO_MAX} antes de persistir. Una bio vacía o solo-espacios la
     * borra (NULL), para que el perfil vuelva a pintarse sin sección de bio.
     */
    @Transactional
    public Usuario actualizarBio(Usuario usuario, String bioRaw, HttpServletRequest request) {
        String limpia = sanitizarBio(bioRaw);
        // Recargar la entidad gestionada: el principal del JWT puede estar desligado/
        // obsoleto, y guardarlo haría merge de TODAS sus columnas, revirtiendo cambios
        // concurrentes (p.ej. eloPvp/pvpPartidos de un duelo que terminó entre la carga
        // del request y este save). Patrón de MarcoService.equipar.
        Usuario gestionado = usuarioRepository.findById(usuario.getId()).orElse(usuario);
        gestionado.setBio(limpia.isEmpty() ? null : limpia);
        usuarioRepository.save(gestionado);
        auditLogService.registrar(AuditEvento.BIO_CAMBIADA, gestionado, null, request);
        return gestionado;
    }

    /**
     * Convierte la bio recibida en texto plano seguro: elimina cualquier
     * etiqueta {@code <...>} (defensa anti-HTML/scripts aunque React ya escapa
     * y el OG la dibuja como texto), colapsa runs de espacios y la trunca al
     * límite de columna.
     */
    static String sanitizarBio(String raw) {
        if (raw == null) return "";
        String sinTags = raw.replaceAll("<[^>]*>", "");
        String colapsado = sinTags.replaceAll("\\s+", " ").trim();
        return colapsado.length() > BIO_MAX ? colapsado.substring(0, BIO_MAX) : colapsado;
    }

    @Transactional(readOnly = true)
    public PerfilStatsDto stats(Usuario usuario) {
        long votosTotales = votoRepository.countByUsuario(usuario);
        long prediccionesAcertadas = prediccionRepository.countByUsuarioAndAcertadaTrue(usuario);
        // Count real de resueltas (antes se contaba el size() de una página capada a
        // 10.000: con >10.000 resueltas el denominador se congelaba mientras el
        // numerador seguía subiendo → el porcentaje del perfil podía superar el 100%,
        // y además cargaba hasta 10.000 entidades solo para contar).
        long prediccionesResueltas = prediccionRepository.countByUsuarioAndAcertadaIsNotNull(usuario);
        // prediccionesTotales = resueltas (las pendientes solo importan en el bracket
        // activo, no en este resumen de perfil).
        long prediccionesTotales = prediccionesResueltas;
        double porcentaje = prediccionesResueltas == 0
                ? 0.0
                : (100.0 * prediccionesAcertadas) / prediccionesResueltas;
        long bracketChallengePuntos = prediccionRepository.puntosCampeonAcumulados(usuario);
        long badges = usuarioLogroRepository.countByUsuario(usuario);
        long torneosCreados = torneoRepository.countByCreadoPor(usuario);
        return new PerfilStatsDto(votosTotales, prediccionesTotales,
                prediccionesAcertadas, prediccionesResueltas,
                redondear(porcentaje, 1), bracketChallengePuntos, badges, torneosCreados,
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
     * Feed combinado de actividad reciente.
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
            payload.put("empate", v.isEmpate());
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
                .findByUsuarioWithLogro(usuario)) {
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
        // del usuario. Filtramos por acertada=true. Variante con JOIN FETCH:
        // este bucle navega personajePredicho/enfrentamiento/torneo por fila, así
        // que las precargamos en una sola query (evita el N+1 del feed de perfil).
        for (Prediccion pred : prediccionRepository.findResueltasDelUsuarioDescFetch(
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
     * Borra la cuenta del usuario.
     *
     * <p>Verifica password antes de proceder. La cascada del schema
     * (V13/V49) elimina datos derivados: refresh tokens, email verifications,
     * predicciones, logros, reacciones, notificaciones, follows, backup
     * codes 2FA. Los votos y referencias PvP se anonimizan (SET NULL) para
     * preservar agregados/historial. Los torneos creados quedan con
     * created_by_user_id=NULL (preservar el bracket publico).
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
        dueloLiveRepository.abandonarActivosDeUsuario(
                usuario,
                List.of(DueloLiveEstado.WAITING, DueloLiveEstado.MATCHED, DueloLiveEstado.IN_PROGRESS),
                LocalDateTime.now());
        // registrar DESPUÉS de verificar password (sin
        // password válido no hay borrado y no debe haber audit), pero ANTES
        // del delete (el FK audit_log.usuario_id necesita una fila viva; la
        // cascada ON DELETE SET NULL lo limpia tras el commit). Síncrono
        // dentro de la misma tx para que ambas escrituras commiteen juntas
        // o se rollee todo. La versión @Async anterior podía persistir
        // tarde con FK violation.
        // no incluir email en los detalles del audit.
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
