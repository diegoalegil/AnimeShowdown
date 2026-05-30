package com.diegoalegil.animeshowdown.security;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

/**
 * Guard anti-SSRF para los fetch server-side de imágenes. El avatar/banner
 * de perfil los fija el usuario y un endpoint OG público los renderiza
 * pegándole a la URL desde el backend, así que sin control un usuario podía
 * apuntar a la red interna (metadata cloud, localhost, rangos privados).
 *
 * <p>Bloquea esquemas distintos de http/https y destinos en rangos internos:
 * loopback (127/8, ::1), link-local + metadata cloud (169.254/16 →
 * 169.254.169.254, fe80::/10), privados IPv4 (10/8, 172.16/12, 192.168/16),
 * ULA IPv6 (fc00::/7), any-local y multicast.
 *
 * <p>{@link #isFetchAllowed} resuelve DNS y valida TODAS las IPs del host
 * (fail-closed): cubre hostnames que apuntan a la red interna. Residual
 * conocido: ventana de DNS rebinding entre esta resolución y la del propio
 * fetch; se mitiga deshabilitando redirects en el caller y por el cacheo de
 * 7 días del OG.
 */
public final class SsrfGuard {

    private SsrfGuard() {
    }

    /**
     * true si la URL es segura para un fetch server-side: esquema http/https y
     * todas las IPs resueltas del host son públicas. Fail-closed: ante URL
     * inválida, host no resoluble o cualquier IP interna devuelve false.
     */
    public static boolean isFetchAllowed(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        final URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (IllegalArgumentException e) {
            return false;
        }
        String scheme = uri.getScheme();
        if (scheme == null
                || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
            return false;
        }
        String host = desbracketear(uri.getHost());
        if (host == null || host.isBlank()) {
            return false;
        }
        try {
            InetAddress[] resueltas = InetAddress.getAllByName(host);
            if (resueltas.length == 0) {
                return false;
            }
            for (InetAddress addr : resueltas) {
                if (isBlockedAddress(addr)) {
                    return false;
                }
            }
            return true;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /**
     * true si {@code host} es una IP literal interna (sin resolver DNS). Para
     * rechazo temprano en validación de input; los hostnames se dejan pasar
     * aquí (los valida {@link #isFetchAllowed} en el fetch real).
     */
    public static boolean isBlockedLiteralHost(String host) {
        String h = desbracketear(host);
        if (h == null || h.isBlank()) {
            return false;
        }
        boolean pareceIpLiteral = h.indexOf(':') >= 0
                || h.matches("\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}");
        if (!pareceIpLiteral) {
            return false;
        }
        try {
            return isBlockedAddress(InetAddress.getByName(h));
        } catch (UnknownHostException e) {
            return false;
        }
    }

    static boolean isBlockedAddress(InetAddress addr) {
        if (addr.isLoopbackAddress()
                || addr.isAnyLocalAddress()
                || addr.isLinkLocalAddress()
                || addr.isSiteLocalAddress()
                || addr.isMulticastAddress()) {
            return true;
        }
        // ULA IPv6 fc00::/7 — isSiteLocalAddress no la cubre.
        if (addr instanceof Inet6Address) {
            return (addr.getAddress()[0] & 0xfe) == 0xfc;
        }
        return false;
    }

    private static String desbracketear(String host) {
        if (host == null) {
            return null;
        }
        String h = host.trim();
        if (h.startsWith("[") && h.endsWith("]") && h.length() > 2) {
            return h.substring(1, h.length() - 1);
        }
        return h;
    }
}
