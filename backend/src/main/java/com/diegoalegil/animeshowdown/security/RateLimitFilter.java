package com.diegoalegil.animeshowdown.security;

import java.io.IOException;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
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
 * Rate limiting in-memory por IP.
 *
 * <p>Aplica a rutas criticas (auth + voto + newsletter) con politicas
 * especificas por endpoint. Cada bucket se separa por policyId + IP para que
 * una ruta ruidosa no consuma el cupo de otra. No es defensa contra botnet
 * grande; ese caso lo cubre Cloudflare aguas arriba.
 *
 * <p>Toggle via property {@code app.ratelimit.enabled} (default true). Los
 * tests de integracion lo desactivan con {@code app.ratelimit.enabled=false}
 * para que no contamine resultados con 429 inesperados.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final RateLimitPolicy LOGIN = new RateLimitPolicy(
            "auth-login", 10, Duration.ofMinutes(1));
    private static final RateLimitPolicy REGISTRO = new RateLimitPolicy(
            "auth-registro", 5, Duration.ofMinutes(1));
    private static final RateLimitPolicy RESET_PASSWORD = new RateLimitPolicy(
            "auth-reset-password", 3, Duration.ofMinutes(1));
    private static final RateLimitPolicy TWO_FACTOR = new RateLimitPolicy(
            "auth-2fa", 5, Duration.ofMinutes(1));
    private static final RateLimitPolicy VOTOS = new RateLimitPolicy(
            "votos", 60, Duration.ofMinutes(1));
    private static final RateLimitPolicy NEWSLETTER = new RateLimitPolicy(
            "newsletter", 5, Duration.ofHours(1));

    private static final String RUTA_VOTAR_SUFIJO = "/votar";
    private static final String RUTA_VOTAR_PREFIJO = "/api/enfrentamientos/";
    private static final String RUTA_VOTAR_PERSONAJE_PREFIJO = "/api/personajes/";

    private final boolean enabled;
    private final Cache<String, Bucket> buckets;
    private final ClientIpExtractor clientIpExtractor;
    private final JwtUtil jwtUtil;
    private final UsuarioRepository usuarioRepository;

    public RateLimitFilter(
            @Value("${app.ratelimit.enabled:true}") boolean enabled,
            ClientIpExtractor clientIpExtractor,
            JwtUtil jwtUtil,
            UsuarioRepository usuarioRepository) {
        this.enabled = enabled;
        this.clientIpExtractor = clientIpExtractor;
        this.jwtUtil = jwtUtil;
        this.usuarioRepository = usuarioRepository;
        this.buckets = Caffeine.newBuilder()
                .maximumSize(10_000)
                .expireAfterAccess(Duration.ofHours(2))
                .build();
        log.info("RateLimitFilter inicializado: enabled={}", enabled);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        RateLimitPolicy policy = resolverPolicy(req);
        if (!enabled || policy == null || esAdmin(req)) {
            chain.doFilter(req, res);
            return;
        }

        String ip = clientIpExtractor.extract(req);
        Bucket bucket = buckets.get(policy.id() + ":" + ip, __ -> nuevoBucket(policy));
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            res.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(req, res);
            return;
        }

        long segundosEspera = Math.max(1, probe.getNanosToWaitForRefill() / 1_000_000_000);
        log.warn("RateLimit excedido ip={} policy={} ruta={} retryAfter={}s",
                ip, policy.id(), req.getRequestURI(), segundosEspera);
        res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        res.setHeader("Retry-After", String.valueOf(segundosEspera));
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("""
                {"message":"Demasiadas peticiones. Intentalo de nuevo en %d segundos.","retryAfter":%d}
                """.formatted(segundosEspera, segundosEspera).strip());
    }

    private RateLimitPolicy resolverPolicy(HttpServletRequest req) {
        if (!"POST".equalsIgnoreCase(req.getMethod())) {
            return null;
        }

        String uri = req.getServletPath();
        if (uri == null) {
            return null;
        }
        if (coincide(uri, "/api/auth/login")) {
            return LOGIN;
        }
        if (coincide(uri, "/api/auth/registro")) {
            return REGISTRO;
        }
        if (coincide(uri, "/api/auth/forgot-password") || coincide(uri, "/api/auth/reset-password")) {
            return RESET_PASSWORD;
        }
        if (coincide(uri, "/api/auth/2fa/verify-login")) {
            return TWO_FACTOR;
        }
        if (coincide(uri, "/api/newsletter")) {
            return NEWSLETTER;
        }
        if (uri.startsWith(RUTA_VOTAR_PREFIJO) && uri.endsWith(RUTA_VOTAR_SUFIJO)) {
            return VOTOS;
        }
        if (uri.startsWith(RUTA_VOTAR_PERSONAJE_PREFIJO) && uri.endsWith(RUTA_VOTAR_SUFIJO)) {
            return VOTOS;
        }
        return null;
    }

    private boolean coincide(String uri, String ruta) {
        return uri.equals(ruta) || uri.equals(ruta + "/");
    }

    private boolean esAdmin(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return false;
        }

        String token = header.substring(7);
        try {
            if (!jwtUtil.validarToken(token)) {
                return false;
            }
            String username = jwtUtil.extraerUsername(token);
            return usuarioRepository.findByUsername(username)
                    .map(usuario -> usuario.getRol() == Rol.ADMIN)
                    .orElse(false);
        } catch (RuntimeException e) {
            log.debug("RateLimit admin bypass no aplicado: {}", e.getMessage());
            return false;
        }
    }

    private Bucket nuevoBucket(RateLimitPolicy policy) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(policy.capacity())
                        .refillGreedy(policy.capacity(), policy.refillPeriod())
                        .build())
                .build();
    }

    private record RateLimitPolicy(String id, long capacity, Duration refillPeriod) {}
}
