package com.diegoalegil.animeshowdown.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.AuditLog;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.AuditLogRepository;
import com.diegoalegil.animeshowdown.security.ClientIpExtractor;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Audit log de eventos de auth/seguridad (Plan v2 §2.6).
 *
 * Diseño:
 *
 *   - registrar() es @Async: la persistencia del audit nunca debe bloquear
 *     la request HTTP del usuario, ni romperla si la BBDD del audit falla.
 *     Si Postgres está saturado, el log puede tardar segundos sin que el
 *     login se vea afectado.
 *
 *   - Propagation.REQUIRES_NEW: el audit corre en su propia transacción.
 *     Si el endpoint principal hace rollback (e.g. exception en cambio de
 *     password), el audit del intento queda igualmente persistido — más
 *     útil para forensics.
 *
 *   - Nunca lanza excepciones. Cualquier fallo se loguea con SLF4J y la
 *     ejecución sigue. El audit es complementario; perderlo no rompe la
 *     funcionalidad del producto.
 *
 *   - IP del cliente vía {@link ClientIpExtractor} (CF-Connecting-IP con
 *     fallback a RemoteAddr) y User-Agent truncado a 500 chars.
 *
 * Llamadas típicas desde AuthController:
 *   auditLogService.registrar(LOGIN_OK, usuario, null, request);
 *   auditLogService.registrar(LOGIN_FAIL, null,
 *       Map.of("identificador", id, "razon", "password_incorrecta"), request);
 */
@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;
    private final ClientIpExtractor clientIpExtractor;

    @Autowired
    @Lazy
    private AuditLogService self;

    public AuditLogService(AuditLogRepository repository, ObjectMapper objectMapper,
            ClientIpExtractor clientIpExtractor) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.clientIpExtractor = clientIpExtractor;
    }

    /**
     * Persiste un evento de audit asíncronamente. Acepta usuario null
     * (eventos pre-login) y detalles null (eventos sin contexto extra).
     * request puede ser null cuando el evento no tiene HttpServletRequest
     * (e.g. eventos disparados por cron jobs).
     */
    public void registrar(
            AuditEvento evento,
            Usuario usuario,
            Map<String, Object> detalles,
            HttpServletRequest request) {
        String ip = request != null ? clientIpExtractor.extract(request) : null;
        String userAgent = request != null ? extraerUserAgent(request) : null;
        self.registrarConContexto(evento, usuario, detalles, ip, userAgent);
    }

    /**
     * Versión asíncrona con contexto HTTP ya materializado. Es importante que
     * el caller capture IP/User-Agent antes de entrar al executor: Tomcat
     * recicla el HttpServletRequest cuando la response termina y leerlo desde
     * un hilo @Async puede fallar con "request object has been recycled".
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarConContexto(
            AuditEvento evento,
            Usuario usuario,
            Map<String, Object> detalles,
            String ip,
            String userAgent) {
        try {
            String detallesJson = serializar(detalles);
            AuditLog entry = new AuditLog(evento, usuario, detallesJson, ip, truncarUserAgent(userAgent));
            repository.save(entry);
        } catch (Exception e) {
            // Audit no debe romper el flujo principal. Logueo con suficiente
            // contexto para investigar a posteriori si fuera necesario.
            log.warn("AuditLogService fallo al persistir evento={} usuario={}: {}",
                    evento, usuario != null ? usuario.getUsername() : "<null>", e.getMessage());
        }
    }

    /** Versión simplificada sin detalles ni request — para eventos cron. */
    public void registrarSimple(AuditEvento evento, Usuario usuario) {
        self.registrarConContexto(evento, usuario, null, null, null);
    }

    /**
     * Versión SÍNCRONA: persiste en la tx del caller (no @Async, no
     * REQUIRES_NEW). Pensada para eventos donde necesitamos garantizar el
     * orden BBDD respecto a una mutación posterior — caso típico:
     * CUENTA_ELIMINADA, que debe insertarse ANTES del DELETE del usuario
     * para que el FK audit_log.usuario_id apunte a una fila aún viva (la
     * cascada ON DELETE SET NULL lo limpia después). Con @Async, el
     * registro podía llegar tras el delete y fallar con FK violation
     * (nota P2 2026-05-17). Si la persistencia lanza, propaga — el caller
     * decide si esa pérdida de audit invalida o no la operación de negocio.
     */
    @Transactional
    public void registrarSync(
            AuditEvento evento,
            Usuario usuario,
            Map<String, Object> detalles,
            HttpServletRequest request) {
        String detallesJson = serializar(detalles);
        String ip = request != null ? clientIpExtractor.extract(request) : null;
        String userAgent = request != null ? extraerUserAgent(request) : null;
        repository.save(new AuditLog(evento, usuario, detallesJson, ip, userAgent));
    }

    private String serializar(Map<String, Object> detalles) {
        if (detalles == null || detalles.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(detalles);
        } catch (JsonProcessingException e) {
            log.warn("AuditLogService: detalles no serializables: {}", e.getMessage());
            return null;
        }
    }

    private String extraerUserAgent(HttpServletRequest req) {
        String ua = req.getHeader("User-Agent");
        return truncarUserAgent(ua);
    }

    private String truncarUserAgent(String ua) {
        if (ua == null) return null;
        return ua.length() > 500 ? ua.substring(0, 500) : ua;
    }
}
