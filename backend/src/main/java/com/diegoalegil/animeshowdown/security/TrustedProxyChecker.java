package com.diegoalegil.animeshowdown.security;

import java.math.BigInteger;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * CIDRs considerados "trusted proxies" — solo si el RemoteAddr cae aquí,
 * {@link ClientIpExtractor} confía en cabeceras tipo {@code CF-Connecting-IP}.
 * Cualquier otro origen (atacante pegando directo al backend de Railway) hace
 * que la cabecera se IGNORE y se use el RemoteAddr real para rate limit/audit.
 *
 * <p>antes {@link ClientIpExtractor} confiaba en
 * {@code CF-Connecting-IP} siempre — un atacante podía pegar directo a Railway
 * con esa cabecera spoofeada y rotar IP por request para bypassear el bucket
 * de 5/min + 50/h y envenenar audit_log.
 *
 * <p>Hardening: las CIDRs privadas RFC1918 NO están en
 * el default. Razonamiento: si el atacante consigue posicionarse en la red
 * privada del proveedor (10.x/172.16/192.168), pegar directo al contenedor
 * con {@code CF-Connecting-IP} spoofeada vuelve a saltarse el rate limit.
 * Para deploys que las necesiten (LB interno que termina TLS y reenvía con
 * IP privada al contenedor) hay que activar explícitamente:
 * <pre>app.trusted-proxies.allow-private=true</pre>
 * Railway en su modo público estándar NO lo necesita.
 *
 * <p>Fuentes oficiales (snapshot 2026-05-17, actualizadas raramente por CF):
 * <ul>
 *   <li>IPv4: https://www.cloudflare.com/ips-v4</li>
 *   <li>IPv6: https://www.cloudflare.com/ips-v6</li>
 * </ul>
 */
@Component
public class TrustedProxyChecker {

    private static final Logger log = LoggerFactory.getLogger(TrustedProxyChecker.class);

    private static final List<String> CLOUDFLARE_IPV4 = List.of(
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
            "131.0.72.0/22");

    private static final List<String> CLOUDFLARE_IPV6 = List.of(
            "2400:cb00::/32",
            "2606:4700::/32",
            "2803:f800::/32",
            "2405:b500::/32",
            "2405:8100::/32",
            "2a06:98c0::/29",
            "2c0f:f248::/32");

    /** Loopback v4 + v6 (dev local y tests). Siempre trusted. */
    private static final List<String> LOOPBACK = List.of("127.0.0.0/8", "::1/128");

    /** RFC1918 — solo se activan si {@code app.trusted-proxies.allow-private=true}. */
    private static final List<String> PRIVATE_IPV4 = List.of(
            "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16");

    /** bits=32 → CIDR IPv4, bits=128 → IPv6. La family se fija al parsear, no a partir del valor. */
    private record Range(BigInteger start, BigInteger end, int bits) {}

    private final List<Range> ranges;

    public TrustedProxyChecker(
            @Value("${app.trusted-proxies.allow-private:false}") boolean allowPrivate) {
        List<String> cidrs = new ArrayList<>();
        cidrs.addAll(CLOUDFLARE_IPV4);
        cidrs.addAll(CLOUDFLARE_IPV6);
        cidrs.addAll(LOOPBACK);
        if (allowPrivate) {
            cidrs.addAll(PRIVATE_IPV4);
        }
        this.ranges = cidrs.stream().map(TrustedProxyChecker::parseCidr).toList();
        log.info(
                "TrustedProxyChecker inicializado con {} CIDRs (CF v4/v6 + loopback{})",
                ranges.size(),
                allowPrivate ? " + RFC1918 privadas" : "");
    }

    /**
     * True si la IP cae en alguno de los rangos trusted. Soporta IPv4 e IPv6.
     * Falsa para IP malformada.
     */
    public boolean isTrusted(String ipStr) {
        if (ipStr == null || ipStr.isBlank()) return false;
        try {
            InetAddress addr = InetAddress.getByName(ipStr.trim());
            BigInteger ip = new BigInteger(1, addr.getAddress());
            int bits = addr.getAddress().length * 8;
            for (Range r : ranges) {
                if (r.bits() != bits) continue;
                if (ip.compareTo(r.start) >= 0 && ip.compareTo(r.end) <= 0) return true;
            }
            return false;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /**
     * Convierte "x.y.z.w/n" o "h:e:x::/n" en [start, end] como BigInteger
     * sin signo. Lanza si la sintaxis es inválida — eso indica bug de
     * configuración y debe romper el boot, no propagarse silencioso.
     */
    private static Range parseCidr(String cidr) {
        String[] parts = cidr.split("/");
        if (parts.length != 2) {
            throw new IllegalArgumentException("CIDR inválido (sin /): " + cidr);
        }
        InetAddress base;
        try {
            base = InetAddress.getByName(parts[0]);
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("CIDR inválido (host): " + cidr, e);
        }
        byte[] bytes = base.getAddress();
        int prefix = Integer.parseInt(parts[1]);
        int totalBits = bytes.length * 8;
        if (prefix < 0 || prefix > totalBits) {
            throw new IllegalArgumentException("CIDR prefix fuera de rango: " + cidr);
        }
        BigInteger ip = new BigInteger(1, bytes);
        BigInteger mask = prefix == 0
                ? BigInteger.ZERO
                : BigInteger.ONE.shiftLeft(totalBits).subtract(BigInteger.ONE)
                        .shiftLeft(totalBits - prefix)
                        .and(BigInteger.ONE.shiftLeft(totalBits).subtract(BigInteger.ONE));
        BigInteger start = ip.and(mask);
        BigInteger end = start.or(
                BigInteger.ONE.shiftLeft(totalBits).subtract(BigInteger.ONE).andNot(mask));
        return new Range(start, end, totalBits);
    }
}
