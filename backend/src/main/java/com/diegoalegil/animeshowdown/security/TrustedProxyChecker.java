package com.diegoalegil.animeshowdown.security;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Lista de CIDRs IPv4 considerados "trusted proxies" — solo si el
 * RemoteAddr cae aquí, {@link ClientIpExtractor} confía en cabeceras
 * tipo {@code CF-Connecting-IP}. Cualquier otro origen (atacante
 * pegando directo al backend de Railway) hace que la cabecera se
 * IGNORE y se use el RemoteAddr real para rate limit/audit.
 *
 * <p>Audit P1.4 (2026-05-17): antes {@link ClientIpExtractor} confiaba
 * en {@code CF-Connecting-IP} siempre — un atacante podía pegar directo
 * a Railway con esa cabecera spoofeada y rotar la IP por cada request
 * para bypassear bucket de 5/min + 50/h y envenenar audit_log.
 *
 * <p>Fuentes de CIDRs:
 * <ul>
 *   <li>Cloudflare IPv4: https://www.cloudflare.com/ips-v4 (oficial,
 *       actualizada poco). Hardcodeada aquí — si CF añade rango nuevo
 *       hay que regenerar (warning en logs si rate-limit detecta IPs
 *       reales fuera de estos rangos).</li>
 *   <li>Loopback {@code 127.0.0.0/8}: dev local + tests H2.</li>
 *   <li>Private {@code 10.0.0.0/8}, {@code 172.16.0.0/12},
 *       {@code 192.168.0.0/16}: red interna de Railway entre el LB y
 *       el contenedor del backend (algunos PaaS terminan TLS en un
 *       proxy interno con IP privada).</li>
 * </ul>
 *
 * <p>IPv6 NO se contempla aquí — Cloudflare propaga IPv6 si el cliente
 * la usa, pero el RemoteAddr del backend en Railway suele ser IPv4 de
 * todos modos. Si en algún momento Railway expone IPv6 directo, hay que
 * extender con las CIDRs IPv6 de CF y soporte InetAddress IPv6.
 */
@Component
public class TrustedProxyChecker {

    private static final Logger log = LoggerFactory.getLogger(TrustedProxyChecker.class);

    /** Snapshot de Cloudflare IPv4 ranges + loopback + private. */
    private static final List<String> CIDRS = List.of(
            // Cloudflare IPv4 (https://www.cloudflare.com/ips-v4)
            "173.245.48.0/20",
            "103.21.244.0/22",
            "103.22.200.0/22",
            "103.31.4.0/22",
            "141.101.64.0/18",
            "108.162.192.0/18",
            "190.93.240.0/20",
            "188.114.96.0/20",
            "197.234.240.0/22",
            "198.41.128.0/17",
            "162.158.0.0/15",
            "104.16.0.0/13",
            "104.24.0.0/14",
            "172.64.0.0/13",
            "131.0.72.0/22",
            // Loopback (dev local + tests)
            "127.0.0.0/8",
            // Private (Railway LB interno → contenedor)
            "10.0.0.0/8",
            "172.16.0.0/12",
            "192.168.0.0/16");

    private final long[] ranges;

    public TrustedProxyChecker() {
        this.ranges = new long[CIDRS.size() * 2];
        for (int i = 0; i < CIDRS.size(); i++) {
            long[] range = parseCidr(CIDRS.get(i));
            ranges[i * 2] = range[0];
            ranges[i * 2 + 1] = range[1];
        }
        log.info("TrustedProxyChecker inicializado con {} CIDRs", CIDRS.size());
    }

    /**
     * True si la IP (string) cae en alguno de los rangos trusted. Devuelve
     * false en caso de IP malformada o IPv6 (no soportada en este snapshot).
     */
    public boolean isTrusted(String ipStr) {
        if (ipStr == null || ipStr.isBlank()) return false;
        try {
            InetAddress addr = InetAddress.getByName(ipStr.trim());
            byte[] bytes = addr.getAddress();
            if (bytes.length != 4) return false; // IPv6 no soportada
            long ip = ((bytes[0] & 0xFFL) << 24)
                    | ((bytes[1] & 0xFFL) << 16)
                    | ((bytes[2] & 0xFFL) << 8)
                    | (bytes[3] & 0xFFL);
            for (int i = 0; i < ranges.length; i += 2) {
                if (ip >= ranges[i] && ip <= ranges[i + 1]) return true;
            }
            return false;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /** Convierte "x.y.z.w/n" en [networkStartLong, networkEndLong]. */
    private static long[] parseCidr(String cidr) {
        String[] parts = cidr.split("/");
        String[] octets = parts[0].split("\\.");
        long ip = (Long.parseLong(octets[0]) << 24)
                | (Long.parseLong(octets[1]) << 16)
                | (Long.parseLong(octets[2]) << 8)
                | Long.parseLong(octets[3]);
        int prefix = Integer.parseInt(parts[1]);
        long mask = prefix == 0 ? 0L : (0xFFFFFFFFL << (32 - prefix)) & 0xFFFFFFFFL;
        long start = ip & mask;
        long end = start | (~mask & 0xFFFFFFFFL);
        return new long[]{ start, end };
    }
}
