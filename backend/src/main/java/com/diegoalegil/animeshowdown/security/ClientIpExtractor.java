package com.diegoalegil.animeshowdown.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Extracción centralizada de la IP del cliente real para rate limit, account
 * lockout y audit log (Plan v2 §2.1/§2.2/§2.6).
 *
 * Estrategia: confiar solo en {@code CF-Connecting-IP}, que Cloudflare
 * sobrescribe siempre en el edge y no se preserva si el cliente la manda.
 * Si la cabecera falta (request directa al backend sin pasar por CF, o tests),
 * cae a {@link HttpServletRequest#getRemoteAddr()}.
 *
 * <p><b>Por qué NO leer {@code X-Forwarded-For}</b>: cualquier proxy intermedio
 * puede añadirla y el backend de Railway acepta tráfico directo si alguien
 * descubre la URL interna. Antes el código tomaba el primer elemento del
 * header como IP del cliente — un atacante podía rotar la cabecera por
 * petición para bypassear el bucket de 5/min + 50/h y envenenar audit_log
 * con IPs falsas. Plan v2 §2.1 cierra ese vector.
 *
 * <p>Si en el futuro se cambia el dominio a "DNS only" (sin proxy CF), las
 * peticiones legítimas llegarán sin {@code CF-Connecting-IP} y se usará
 * {@code RemoteAddr}. El rate limit seguirá funcionando con la IP del
 * primer salto — el problema es entonces de exposición de infra (Railway
 * sin allowlist), no de código.
 */
public final class ClientIpExtractor {

    private static final String CF_CONNECTING_IP = "CF-Connecting-IP";

    private ClientIpExtractor() {
        // utility
    }

    /**
     * Devuelve la IP del cliente real. Nunca devuelve null (cae a
     * {@code RemoteAddr}, que el contenedor siempre tiene).
     */
    public static String extract(HttpServletRequest req) {
        String cf = req.getHeader(CF_CONNECTING_IP);
        if (cf != null && !cf.isBlank()) {
            return cf.trim();
        }
        return req.getRemoteAddr();
    }
}
