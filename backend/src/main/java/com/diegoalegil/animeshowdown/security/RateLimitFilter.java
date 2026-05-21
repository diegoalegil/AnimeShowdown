package com.diegoalegil.animeshowdown.security;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Rate limiting in-memory por IP. Plan v2 §2.1.
 *
 * Aplica a rutas críticas (auth + voto) con un bandwidth compuesto:
 *   - 5 requests / minuto: ráfaga corta
 *   - 50 requests / hora: total acumulado
 *
 * Ambos se evalúan en paralelo — la petición se rechaza si CUALQUIERA
 * está agotado. El segundo evita ataques que distribuyan tráfico para
 * burlar la ventana de 1 minuto (e.g. 4 por minuto durante varias horas).
 *
 * Buckets en Caffeine LRU 10000 entradas. Si un atacante usara una
 * IP rotation con 10k+ IPs activas dejaría sin espacio a los demás —
 * en ese caso Caffeine evictea las menos usadas. No es defensa contra
 * botnet grande; ese caso lo cubre Cloudflare aguas arriba.
 *
 * Toggle vía property `app.ratelimit.enabled` (default true). Los tests
 * lo desactivan con `app.ratelimit.enabled=false` para que no contaminen
 * resultados con 429 inesperados.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    /**
     * Rutas que disparan rate limit. Se evalúa con `startsWith` después
     * de quitar el contexto, así que `/api/auth/login` cubre tanto
     * `/api/auth/login` como `/api/auth/login/` (Spring normaliza).
     */
    private static final List<String> RUTAS_LIMITADAS = List.of(
            "/api/auth/login",
            "/api/auth/registro",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            // Plan v2 §2.3: el endpoint que valida el segundo factor también
            // necesita rate limit — sin él, alguien con el challengeToken
            // (60s) podría intentar 10⁶ códigos en paralelo desde varias IPs.
            // Bucket4j por IP no detiene el caso ideal pero sí frena el básico.
            "/api/auth/2fa/verify-login",
            // Audit P2 (2026-05-17): newsletter envía email de confirmación
            // double opt-in. Sin rate limit, un script podía pinchar
            // POST /api/newsletter miles de veces con emails ajenos →
            // spam de confirmación a víctimas + Resend quota agotada +
            // posible bloqueo de envío de emails reales (verificación,
            // reset password). El startsWith cubre la ruta canonical.
            "/api/newsletter");

    private static final String RUTA_VOTAR_SUFIJO = "/votar";
    private static final String RUTA_VOTAR_PREFIJO = "/api/enfrentamientos/";
    // Audit P2.5 (2026-05-17): endpoint legacy /api/personajes/{id}/votar
    // también entra al rate limit. Antes solo el moderno (enfrentamientos)
    // estaba limitado y el legacy era un bypass trivial.
    private static final String RUTA_VOTAR_PERSONAJE_PREFIJO = "/api/personajes/";

    private final boolean enabled;
    private final Cache<String, Bucket> buckets;
    private final ClientIpExtractor clientIpExtractor;

    public RateLimitFilter(@Value("${app.ratelimit.enabled:true}") boolean enabled,
            ClientIpExtractor clientIpExtractor) {
        this.enabled = enabled;
        this.clientIpExtractor = clientIpExtractor;
        this.buckets = Caffeine.newBuilder()
                .maximumSize(10_000)
                .expireAfterAccess(Duration.ofHours(2))
                .build();
        log.info("RateLimitFilter inicializado: enabled={}", enabled);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (!enabled || !esRutaLimitada(req)) {
            chain.doFilter(req, res);
            return;
        }
        String ip = clientIpExtractor.extract(req);
        Bucket bucket = buckets.get(ip, k -> nuevoBucket());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            // Header informativo opcional — útil para debug y para que
            // clientes legítimos puedan ralentizarse antes de ser bloqueados.
            res.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(req, res);
            return;
        }
        long segundosEspera = Math.max(1, probe.getNanosToWaitForRefill() / 1_000_000_000);
        log.warn("RateLimit excedido ip={} ruta={} retryAfter={}s",
                ip, req.getRequestURI(), segundosEspera);
        res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        res.setHeader("Retry-After", String.valueOf(segundosEspera));
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("""
                {"message":"Demasiadas peticiones. Inténtalo de nuevo en %d segundos.","retryAfter":%d}
                """.formatted(segundosEspera, segundosEspera).strip());
    }

    private boolean esRutaLimitada(HttpServletRequest req) {
        if (!"POST".equalsIgnoreCase(req.getMethod())) return false;
        // Audit fix #12 (2026-05-21): antes usabamos req.getRequestURI() que
        // INCLUYE el context path. Si la app se deploya con context path
        // (e.g. server.servlet.context-path=/api-v2), los URIs llegan como
        // '/api-v2/api/auth/login' y NO matchean con RUTAS_LIMITADAS que
        // tienen '/api/auth/login'. Rate limiting silenciosamente apagado.
        //
        // req.getServletPath() devuelve el path RELATIVO al context path —
        // consistente con como Spring Security define los matchers en
        // SecurityConfig. Portable a cualquier deploy con context root.
        String uri = req.getServletPath();
        if (uri == null) return false;
        for (String prefijo : RUTAS_LIMITADAS) {
            if (uri.equals(prefijo) || uri.startsWith(prefijo + "/")) return true;
        }
        // /api/enfrentamientos/{id}/votar — id variable.
        if (uri.startsWith(RUTA_VOTAR_PREFIJO) && uri.endsWith(RUTA_VOTAR_SUFIJO)) {
            return true;
        }
        // /api/personajes/{id}/votar — endpoint legacy (P2.5).
        if (uri.startsWith(RUTA_VOTAR_PERSONAJE_PREFIJO) && uri.endsWith(RUTA_VOTAR_SUFIJO)) {
            return true;
        }
        return false;
    }

    private Bucket nuevoBucket() {
        // 5/min + 50/hora compuestos. Bucket4j evalúa AMBOS antes de
        // permitir consumir — cumple ambos límites simultáneamente.
        return Bucket.builder()
                .addLimit(Bandwidth.simple(5, Duration.ofMinutes(1)))
                .addLimit(Bandwidth.simple(50, Duration.ofHours(1)))
                .build();
    }

}
