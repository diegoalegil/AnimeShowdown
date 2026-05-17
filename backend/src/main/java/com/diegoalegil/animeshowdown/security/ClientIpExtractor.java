package com.diegoalegil.animeshowdown.security;

import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Extracción centralizada de la IP del cliente real para rate limit, account
 * lockout y audit log (Plan v2 §2.1/§2.2/§2.6 + auditoría P1.4 2026-05-17).
 *
 * <p>Estrategia: confiar en {@code CF-Connecting-IP} <b>solo si</b> el
 * {@code RemoteAddr} cae en un CIDR de {@link TrustedProxyChecker}
 * (Cloudflare + loopback + private). Antes confiaba siempre — un
 * atacante pegando directo a Railway podía rotar la cabecera por
 * petición para bypassear el bucket de 5/min + 50/h y envenenar
 * audit_log.
 *
 * <p>Si la cabecera no está presente o el RemoteAddr no es trusted,
 * se usa {@link HttpServletRequest#getRemoteAddr()} crudo. Esto
 * preserva la funcionalidad legítima cuando Cloudflare hace de proxy
 * (caso normal en producción) y cierra el vector cuando alguien
 * accede directo al backend.
 *
 * <p>Pasa de utility estática a {@code @Component} para inyectar
 * {@link TrustedProxyChecker}. Los callers (RateLimitFilter,
 * AuthController, AuditLogService) lo reciben por constructor.
 */
@Component
public class ClientIpExtractor {

    private static final String CF_CONNECTING_IP = "CF-Connecting-IP";

    private final TrustedProxyChecker trustedProxy;

    public ClientIpExtractor(TrustedProxyChecker trustedProxy) {
        this.trustedProxy = trustedProxy;
    }

    /**
     * Devuelve la IP real del cliente. Nunca devuelve null (cae a
     * RemoteAddr si no hay otra fuente confiable).
     */
    public String extract(HttpServletRequest req) {
        String remote = req.getRemoteAddr();
        String cf = req.getHeader(CF_CONNECTING_IP);
        if (cf != null && !cf.isBlank() && trustedProxy.isTrusted(remote)) {
            return cf.trim();
        }
        return remote;
    }
}
