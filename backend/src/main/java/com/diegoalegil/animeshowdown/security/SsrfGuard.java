package com.diegoalegil.animeshowdown.security;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;

/**
 * Guard anti-SSRF para los fetch server-side de imágenes. El avatar/banner
 * de perfil los fija el usuario y un endpoint OG público los renderiza
 * pegándole a la URL desde el backend, así que sin control un usuario podía
 * apuntar a la red interna (metadata cloud, localhost, rangos privados).
 *
 * <p>Bloquea esquemas distintos de http/https y destinos en rangos internos:
 * loopback (127/8, ::1), link-local + metadata cloud (169.254/16 →
 * 169.254.169.254, fe80::/10), privados IPv4 (10/8, 172.16/12, 192.168/16),
 * ULA IPv6 (fc00::/7), rangos especiales IANA (CGNAT, benchmarking,
 * documentacion, 6to4/NAT64, AS112/SRv6, reservados), any-local y multicast.
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
        byte[] bytes = addr.getAddress();
        if (bytes.length == 4) {
            return isBlockedIpv4(bytes);
        }
        if (isIpv4Mapped(bytes)) {
            return isBlockedIpv4(Arrays.copyOfRange(bytes, 12, 16));
        }
        // ULA IPv6 fc00::/7 - isSiteLocalAddress no la cubre.
        if (addr instanceof Inet6Address) {
            return (bytes[0] & 0xfe) == 0xfc
                    || matchesPrefix(bytes, new int[] {0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0}, 96) // 64:ff9b::/96
                    || matchesPrefix(bytes, new int[] {0, 0x64, 0xff, 0x9b, 0, 0x01}, 48) // 64:ff9b:1::/48
                    || matchesPrefix(bytes, new int[] {0x01, 0, 0, 0, 0, 0, 0, 0}, 64) // 100::/64 discard-only
                    || matchesPrefix(bytes, new int[] {0x01, 0, 0, 0, 0, 0, 0, 0x01}, 64) // 100:0:0:1::/64 dummy
                    || matchesPrefix(bytes, new int[] {0x20, 0x01, 0x00}, 23) // IETF special 2001::/23
                    || matchesPrefix(bytes, new int[] {0x20, 0x01, 0x0d, 0xb8}, 32) // 2001:db8::/32 doc
                    || matchesPrefix(bytes, new int[] {0x20, 0x02}, 16) // 6to4 2002::/16
                    || matchesPrefix(bytes, new int[] {0x26, 0x20, 0x00, 0x4f, 0x80, 0x00}, 48) // AS112-v6
                    || matchesPrefix(bytes, new int[] {0x3f, 0xff, 0x00}, 20) // 3fff::/20 doc
                    || matchesPrefix(bytes, new int[] {0x5f, 0x00}, 16); // SRv6 SIDs
        }
        return false;
    }

    private static boolean isBlockedIpv4(byte[] bytes) {
        int b0 = Byte.toUnsignedInt(bytes[0]);
        int b1 = Byte.toUnsignedInt(bytes[1]);
        int b2 = Byte.toUnsignedInt(bytes[2]);
        return b0 == 0
                || b0 == 100 && b1 >= 64 && b1 <= 127 // 100.64.0.0/10 CGNAT
                || b0 == 192 && b1 == 0 && b2 == 0 // 192.0.0.0/24 IETF
                || b0 == 192 && b1 == 0 && b2 == 2 // 192.0.2.0/24 TEST-NET-1
                || b0 == 192 && b1 == 31 && b2 == 196 // 192.31.196.0/24 AS112-v4
                || b0 == 192 && b1 == 52 && b2 == 193 // 192.52.193.0/24 AMT
                || b0 == 192 && b1 == 88 && b2 == 99 // 192.88.99.0/24 6to4 relay
                || b0 == 192 && b1 == 175 && b2 == 48 // 192.175.48.0/24 AS112-v4
                || b0 == 198 && (b1 == 18 || b1 == 19) // 198.18.0.0/15 benchmark
                || b0 == 198 && b1 == 51 && b2 == 100 // 198.51.100.0/24 TEST-NET-2
                || b0 == 203 && b1 == 0 && b2 == 113 // 203.0.113.0/24 TEST-NET-3
                || b0 >= 240; // reservado, incluye 255.255.255.255
    }

    private static boolean isIpv4Mapped(byte[] bytes) {
        if (bytes.length != 16) {
            return false;
        }
        for (int i = 0; i < 10; i++) {
            if (bytes[i] != 0) {
                return false;
            }
        }
        return bytes[10] == (byte) 0xff && bytes[11] == (byte) 0xff;
    }

    private static boolean matchesPrefix(byte[] address, int[] prefix, int prefixBits) {
        int fullBytes = prefixBits / 8;
        int remainingBits = prefixBits % 8;
        for (int i = 0; i < fullBytes; i++) {
            if (Byte.toUnsignedInt(address[i]) != prefix[i]) {
                return false;
            }
        }
        if (remainingBits == 0) {
            return true;
        }
        int mask = 0xff << (8 - remainingBits) & 0xff;
        return (Byte.toUnsignedInt(address[fullBytes]) & mask) == (prefix[fullBytes] & mask);
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
