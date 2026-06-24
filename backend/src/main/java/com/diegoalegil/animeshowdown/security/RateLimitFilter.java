package com.diegoalegil.animeshowdown.security;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;

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
    // GET costosos: render server-side de imagenes. Cloudflare cachea OG aguas
    // arriba (7d), asi que el grueso del trafico legitimo no llega al origen;
    // este limite protege de combinaciones NO cacheadas a alto ritmo desde una
    // misma IP (DoS por coste: Graphics2D + fetch remoto por request).
    private static final RateLimitPolicy OG_IMAGE = new RateLimitPolicy(
            "og-image", 60, Duration.ofMinutes(1));
    private static final RateLimitPolicy CARD_DOWNLOAD = new RateLimitPolicy(
            "card-download", 30, Duration.ofMinutes(1));
    // Economía: POST /api/me/cartas/** (abrir sobre, cofre diario, bienvenida,
    // sobres gratis, trades). Cada uno toma locks pesimistas de fila + escribe
    // ledger; 60/min por IP corta el martilleo (DoS de contención de locks) sin
    // molestar a un usuario real (jamás necesita >60 acciones de economía/min).
    private static final RateLimitPolicy ECONOMIA = new RateLimitPolicy(
            "economia", 60, Duration.ofMinutes(1));
    // Social: POST de reacciones, comentarios y seguir. 60/min por IP.
    private static final RateLimitPolicy SOCIAL = new RateLimitPolicy(
            "social", 60, Duration.ofMinutes(1));
    // ELO Duel (juego higher-or-lower): GET /round genera un par aleatorio
    // (coste CPU) y POST /guess lo resuelve (CPU + lectura DB). Ambos son
    // permitAll sin auth; sin límite una IP los martillea a velocidad de red
    // consumiendo CPU y conexiones. 30/min por IP no molesta a un jugador real
    // (un guess cada 2s sostenido) y corta el abuso.
    private static final RateLimitPolicy ELO_DUEL = new RateLimitPolicy(
            "elo-duel", 30, Duration.ofMinutes(1));
    // Wrapped público (GET /api/wrapped/u/{username}, permitAll): cada request
    // ejecuta 5+ queries NO cacheadas sobre la tabla votos. Sin límite un anónimo
    // amplifica carga de DB a coste cero (DoS de coste). 30/min por IP no molesta
    // a quien comparte/abre un wrapped y corta el martilleo.
    private static final RateLimitPolicy WRAPPED = new RateLimitPolicy(
            "wrapped", 30, Duration.ofMinutes(1));

    // Policies donde el bypass de admin NO aplica — el límite es UNIVERSAL:
    //   · auth (login/2fa/registro/reset): fuerza-bruta sobre credenciales; un
    //     admin no tiene motivo legítimo para saltárselo y un token robado no
    //     debe poder martillear credenciales ajenas.
    //   · social (reacciones/comentarios/seguir) y economía (sobres/cofres/
    //     trades): son acciones de usuario que mutan estado y toman locks
    //     pesimistas, no operativa de lectura. Ningún admin las ejecuta a
    //     >60/min legítimamente (moderar va por endpoints de admin aparte); el
    //     bypass solo abriría spam/DoS por contención de locks si el token admin
    //     se compromete.
    // El resto (imágenes/descargas/GET de render) sí concede bypass — ahí un
    // admin sí puede tener picos legítimos de preview/tooling y no muta estado.
    private static final Set<String> POLICIES_SIN_BYPASS_ADMIN = Set.of(
            LOGIN.id(), REGISTRO.id(), RESET_PASSWORD.id(), TWO_FACTOR.id(),
            SOCIAL.id(), ECONOMIA.id());

    private static final String RUTA_ELO_DUEL_PREFIJO = "/api/games/elo-duel/";
    private static final String RUTA_WRAPPED_PUBLICO_PREFIJO = "/api/wrapped/u/";
    private static final String RUTA_VOTAR_SUFIJO = "/votar";
    private static final String RUTA_VOTAR_PREFIJO = "/api/enfrentamientos/";
    private static final String RUTA_VOTAR_PERSONAJE_PREFIJO = "/api/personajes/";
    private static final String RUTA_OG_PREFIJO = "/api/og/";
    private static final String RUTA_CARTAS_PREFIJO = "/api/me/cartas/";
    private static final String RUTA_DESCARGA_SUFIJO = "/descargar";
    private static final String RUTA_REACCIONES = "/api/reacciones";
    private static final String RUTA_COMENTARIOS_SUFIJO = "/comentarios";
    private static final String RUTA_SEGUIDORES_PREFIJO = "/api/seguidores/";

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
        if (!enabled || policy == null) {
            chain.doFilter(req, res);
            return;
        }
        // Bypass de admin en todo MENOS las policies de fuerza-bruta. El
        // contains() va primero a propósito: en endpoints de auth corta por
        // short-circuit y ni siquiera paga el lookup a BD de esAdmin().
        if (!POLICIES_SIN_BYPASS_ADMIN.contains(policy.id()) && esAdmin(req)) {
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
        String uri = req.getServletPath();
        if (uri == null) {
            return null;
        }
        String method = req.getMethod();

        // GET costosos (render server-side de PNG): se limitan aparte porque no
        // son POST. El bypass de admin y los buckets por IP se reutilizan igual.
        if ("GET".equalsIgnoreCase(method)) {
            if (uri.startsWith(RUTA_OG_PREFIJO)) {
                return OG_IMAGE;
            }
            if (uri.startsWith(RUTA_CARTAS_PREFIJO) && uri.endsWith(RUTA_DESCARGA_SUFIJO)) {
                return CARD_DOWNLOAD;
            }
            if (uri.startsWith(RUTA_ELO_DUEL_PREFIJO)) {
                return ELO_DUEL;
            }
            if (uri.startsWith(RUTA_WRAPPED_PUBLICO_PREFIJO)) {
                return WRAPPED;
            }
            return null;
        }

        // PUT sensible: cambio de password de la sesión. Mismo presupuesto
        // que el reset para frenar fuerza bruta de la password actual.
        if ("PUT".equalsIgnoreCase(method) && coincide(uri, "/api/auth/me/password")) {
            return RESET_PASSWORD;
        }
        if (!"POST".equalsIgnoreCase(method)) {
            return null;
        }
        if (uri.startsWith(RUTA_ELO_DUEL_PREFIJO)) {
            return ELO_DUEL;
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
        if (coincide(uri, "/api/auth/resend-verification")) {
            return RESET_PASSWORD;
        }
        // Todo el resto de 2FA (verify-login, enable, disable, setup,
        // backup-codes/regenerar) comparte presupuesto: cada uno acepta o
        // valida códigos TOTP y es objetivo de fuerza bruta.
        if (uri.startsWith("/api/auth/2fa/")) {
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
        // POST de economía: todo bajo /api/me/cartas/ (sobre, cofre, bienvenida,
        // sobres-gratis abrir, trades). Comparten un bucket "economia" por IP.
        if (uri.startsWith(RUTA_CARTAS_PREFIJO)) {
            return ECONOMIA;
        }
        // POST sociales: reacciones, crear comentario (.../comentarios) y seguir.
        if (coincide(uri, RUTA_REACCIONES)
                || uri.endsWith(RUTA_COMENTARIOS_SUFIJO)
                || uri.startsWith(RUTA_SEGUIDORES_PREFIJO)) {
            return SOCIAL;
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
