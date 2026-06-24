package com.diegoalegil.animeshowdown.config;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.diegoalegil.animeshowdown.security.HttpCookieOAuth2AuthorizationRequestRepository;
import com.diegoalegil.animeshowdown.security.JwtAuthFilter;
import com.diegoalegil.animeshowdown.security.OAuth2LoginFailureHandler;
import com.diegoalegil.animeshowdown.security.OAuth2LoginSuccessHandler;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final com.diegoalegil.animeshowdown.security.RateLimitFilter rateLimitFilter;
    private final OAuth2LoginSuccessHandler oauth2LoginSuccessHandler;
    private final OAuth2LoginFailureHandler oauth2LoginFailureHandler;
    private final HttpCookieOAuth2AuthorizationRequestRepository authorizationRequestRepository;
    private final String allowedOriginsCsv;
    private final String allowedOriginPatternsCsv;
    private final String activeProfile;
    private final boolean swaggerPublicOverride;

    // Perfiles de desarrollo donde Swagger/OpenAPI se expone sin auth. Cualquier
    // otro perfil (production, prod, railway, staging, vacio, o un CSV sin un
    // perfil dev) exige ROLE_ADMIN — fail-closed.
    private static final Set<String> PERFILES_DEV = Set.of("dev", "local", "test");

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            com.diegoalegil.animeshowdown.security.RateLimitFilter rateLimitFilter,
            OAuth2LoginSuccessHandler oauth2LoginSuccessHandler,
            OAuth2LoginFailureHandler oauth2LoginFailureHandler,
            HttpCookieOAuth2AuthorizationRequestRepository authorizationRequestRepository,
            @Value("${cors.allowed-origins:}") String allowedOriginsCsv,
            @Value("${cors.allowed-origin-patterns:}") String allowedOriginPatternsCsv,
            @Value("${spring.profiles.active:}") String activeProfile,
            @Value("${app.swagger.public:false}") boolean swaggerPublicOverride) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.rateLimitFilter = rateLimitFilter;
        this.oauth2LoginSuccessHandler = oauth2LoginSuccessHandler;
        this.oauth2LoginFailureHandler = oauth2LoginFailureHandler;
        this.authorizationRequestRepository = authorizationRequestRepository;
        this.allowedOriginsCsv = allowedOriginsCsv;
        this.allowedOriginPatternsCsv = allowedOriginPatternsCsv;
        this.activeProfile = activeProfile;
        this.swaggerPublicOverride = swaggerPublicOverride;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                // OAuth2 necesita conservar la authorization request entre
                // /oauth2/authorization/* y /login/oauth2/code/*. El resto
                // del API sigue usando JWT stateless; Spring solo crea
                // sesión cuando el flujo OAuth la requiere.
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .headers(headers -> headers
                        .referrerPolicy(referrer -> referrer.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        // HSTS: un año + subdominios. Spring solo lo emite en
                        // respuestas HTTPS, así que en dev local no molesta.
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000))
                        .addHeaderWriter(new StaticHeadersWriter(
                                "Permissions-Policy",
                                "camera=(), microphone=(), geolocation=()"))
                        .addHeaderWriter(new StaticHeadersWriter(
                                "Cross-Origin-Opener-Policy",
                                "same-origin"))
                        .addHeaderWriter(new StaticHeadersWriter(
                                "Cross-Origin-Resource-Policy",
                                "same-site"))
                        // CSP de API: las respuestas son JSON/PNG, nunca deben
                        // ejecutarse como documento. Swagger UI queda fuera
                        // porque sí necesita sus scripts/estilos.
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(
                                new NegatedRequestMatcher(new OrRequestMatcher(
                                        PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui/**"),
                                        PathPatternRequestMatcher.withDefaults().matcher("/v3/api-docs/**"))),
                                new StaticHeadersWriter(
                                        "Content-Security-Policy",
                                        "default-src 'none'; frame-ancestors 'none'"))))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        // /actuator/prometheus
                        // expone métricas internas (endpoints, latencias,
                        // tasas de error, nombres de queries) — útiles para
                        // un atacante que quiera mapear superficie.
                        // health e info siguen públicos: el primero lo usa
                        // Railway/Cloudflare healthcheck, el segundo no
                        // expone datos sensibles.
                        // /actuator/prometheus pasa por PrometheusAuthFilter
                        // que valida X-Prometheus-Token contra
                        // app.prometheus.scrape-token (igual patrón que el
                        // cron secret de /api/cron/**). Sin token configurado
                        // el filtro denega siempre — modo seguro por defecto.
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/prometheus").permitAll()
                        // El grupo PÚBLICO del OpenAPI (/v3/api-docs/public) se sirve
                        // SIN auth: contrato de la API de lectura pública para terceros
                        // (springdoc GroupedOpenApi "public" en OpenApiConfig, filtrado a
                        // endpoints públicos y excluyendo admin/auth/me/cron). Debe ir
                        // ANTES de la regla gated /v3/api-docs/** (match por orden). El
                        // spec es solo documentación; no altera la seguridad de endpoints.
                        .requestMatchers(HttpMethod.GET, "/v3/api-docs/public", "/v3/api-docs/public/**")
                        .permitAll()
                        // Swagger/OpenAPI completo: requiere rol ADMIN en producción
                        // para no exponer la estructura completa de API a público.
                        // En dev/local funciona sin login; el spec sigue accesible tras auth.
                        .requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml",
                                "/swagger-ui.html", "/swagger-ui/**", "/swagger-resources/**", "/webjars/**")
                        .access(swaggerAuthorizationManager())
                        // Endpoint STOMP/WebSocket. El handshake
                        // HTTP es público; la autenticación se hace en el frame
                        // CONNECT con JWT (ver WebSocketConfig.JwtAuthChannelInterceptor).
                        .requestMatchers("/ws", "/ws/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // /api/cron/** se autentica con
                        // X-Cron-Secret header (no JWT), así el GitHub
                        // Action no necesita login que falla si el admin
                        // tiene 2FA. La validación del secret se hace en
                        // CronTorneoController.
                        .requestMatchers("/api/cron/**").permitAll()
                        // POST /api/personajes/*/votar
                        // está deshabilitado (devuelve 410 GONE en el controller).
                        // Antes requería auth → clientes anónimos veían 401, no
                        // el 410 que comunica explícitamente la deprecación.
                        // Lo hacemos público para que el 410 llegue siempre.
                        .requestMatchers(HttpMethod.POST, "/api/personajes/*/votar").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/enfrentamientos/*/votar").permitAll()
                        // Set-once de la intención de voto (feature #15). Público
                        // igual que el voto: los votantes invitados (anónimos)
                        // también pueden anotar su categoría; el controller los
                        // identifica por sesión y solo deja fijarla una vez.
                        .requestMatchers(HttpMethod.PATCH, "/api/enfrentamientos/*/votar/categoria").permitAll()
                        // Lectura pública para que VotarPage pueda mostrar el match aleatorio
                        // antes de pedir login (el voto sí requiere auth, regla de arriba).
                        .requestMatchers(HttpMethod.GET, "/api/enfrentamientos/**").permitAll()
                        // Mi roster / favoritos. Estas rutas tienen que aparecer ANTES de las reglas
                        // generales de /api/personajes/** porque Spring
                        // Security matchea por orden. Sin esto, POST/DELETE
                        // /favorito caía en hasRole("ADMIN") y se rechazaba
                        // a usuarios normales.
                        .requestMatchers(HttpMethod.GET, "/api/personajes/*/favorito").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/personajes/*/favorito").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/personajes/*/favorito").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/personajes/*/comentarios").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/personajes/*/comentarios").authenticated()
                        .requestMatchers("/api/comentarios/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/me/favoritos").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/personajes/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/eventos/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/torneos/mios").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/torneos/**").permitAll()
                        // Torneos creados por usuario verificado.
                        // POST /mio es autenticado normal; el service valida
                        // la verificación de email. El resto de POST/PUT/DELETE
                        // sobre /api/torneos sigue siendo admin-only.
                        .requestMatchers(HttpMethod.POST, "/api/torneos/mio").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/tier-lists/public/**").permitAll()
                        .requestMatchers("/api/tier-lists/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/votar/**").permitAll()
                        .requestMatchers("/api/votos/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/games/elo-duel/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/games/elo-duel/**").permitAll()
                        // Catálogo de badges público (cacheable
                        // long-term en frontend); /mios requiere auth para
                        // saber a qué usuario pertenecen los desbloqueos.
                        // §4.10: /stats agregado por badge es público — alimenta
                        // la página /logros con la rareza real de la comunidad.
                        .requestMatchers(HttpMethod.GET, "/api/logros").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/logros/stats").permitAll()
                        .requestMatchers("/api/logros/mios").authenticated()
                        // Reactions emoji. GET público (todos
                        // ven los counts); POST autenticado (1 reaction por
                        // user-target con lógica toggle/swap en el service).
                        .requestMatchers(HttpMethod.GET, "/api/reacciones").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/reacciones").authenticated()
                        // Predicciones de bracket. Leaderboard
                        // público (top predictores); /mias y POST autenticados.
                        .requestMatchers(HttpMethod.GET, "/api/predicciones/leaderboard").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/predicciones/leaderboard/torneo/**").permitAll()
                        .requestMatchers("/api/predicciones/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/fantasy/leaderboard").permitAll()
                        .requestMatchers("/api/fantasy/**").authenticated()
                        // Newsletter con double opt-in. Todo
                        // público — form en footer y links de confirmación
                        // /unsubscribe llegan al email del user sin auth.
                        .requestMatchers("/api/newsletter/**").permitAll()
                        // Friends / follow. GET de listas y
                        // stats es público (perfiles ajenos). POST/DELETE
                        // requiere ser el seguidor (auth).
                        .requestMatchers(HttpMethod.GET, "/api/seguidores/usuario/**").permitAll()
                        .requestMatchers("/api/seguidores/**").authenticated()
                        // Perfil público por username. /me/** son
                        // del usuario autenticado (historial privado, etc).
                        // /api/perfil/{username} muestra stats + top + logros
                        // públicos sin necesidad de login.
                        .requestMatchers(HttpMethod.GET, "/api/perfil/me/**").authenticated()
                        // DELETE /api/perfil/me (GDPR right to
                        // erasure). Requiere sesión + reconfirmación de password
                        // en el body.
                        .requestMatchers(HttpMethod.DELETE, "/api/perfil/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/perfil/*").permitAll()
                        // OG images server-side: los PNG los consumen
                        // crawlers anónimos de Twitter/Discord/Slack/etc, sin auth.
                        .requestMatchers(HttpMethod.GET, "/api/og/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/og/**").permitAll()
                        // Salón Legendario: galería pública de cartas especiales
                        // (cualquiera ve los teasers; el dueño las tiene/usa).
                        .requestMatchers(HttpMethod.GET, "/api/cartas/especiales").permitAll()
                        // Odds del sobre: datos de diseño globales (precio, pool,
                        // prob. por rareza). Públicos para que el invitado vea la
                        // transparencia antes de registrarse (gancho de conversión).
                        .requestMatchers(HttpMethod.GET, "/api/cartas/odds").permitAll()
                        // Wrapped PÚBLICO por opt-in: SOLO la ruta /u/{username}.
                        // El controller devuelve 404 salvo que el dueño haya hecho
                        // opt-in (wrapped_publico=true). /api/wrapped/me sigue
                        // autenticado por el fallback anyRequest().authenticated().
                        .requestMatchers(HttpMethod.GET, "/api/wrapped/u/**").permitAll()
                        // Datos para sitemap dinámico. Consumido por
                        // el script generate-sitemap.mjs en build de Cloudflare
                        // Pages; público porque sitemaps son públicos por definición.
                        .requestMatchers(HttpMethod.GET, "/api/sitemap/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/status").permitAll()
                        .requestMatchers("/api/duelo-live/**").authenticated()
                        .requestMatchers("/api/auth/me", "/api/auth/me/**").authenticated()
                        // §SEC-003: estas rutas modifican el 2FA o las sesiones del
                        // usuario AUTENTICADO. Antes solo las protegía el check
                        // usuario==null del controller (en la cadena eran permitAll por
                        // el patrón /api/auth/**). Las exigimos authenticated explícitamente
                        // como defensa en profundidad. OJO: /2fa/verify-login NO entra aquí
                        // — es el paso 2 del login y el usuario aún no está autenticado.
                        .requestMatchers("/api/auth/2fa/setup", "/api/auth/2fa/enable",
                                "/api/auth/2fa/disable", "/api/auth/2fa/backup-codes/regenerar",
                                "/api/auth/revoke-all").authenticated()
                        .requestMatchers("/api/auth/**").permitAll()
                        .anyRequest().authenticated())
                // rateLimitFilter va ANTES del jwtAuthFilter para que las
                // peticiones bloqueadas con 429 no consuman recursos parseando
                // JWT. jwtAuthFilter sigue corriendo en peticiones permitidas.
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(jwtAuthFilter, com.diegoalegil.animeshowdown.security.RateLimitFilter.class)
                // oauth2Login instala un entry point de navegador que
                // redirige a /login. Para /api/** eso es una regresión:
                // clientes SPA/tests necesitan un status HTTP, no HTML ni
                // 302. Dejamos el redirect para rutas web/OAuth y fijamos
                // 403 en API sin sesión, igual que antes del OAuth sprint.
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.FORBIDDEN),
                                request -> request.getServletPath().startsWith("/api/")))
                .oauth2Login(oauth -> oauth
                        // Cookie-based authorization request repository.
                        // El default (HttpSessionOAuth2AuthorizationRequestRepository)
                        // guarda el state OAuth en la HttpSession, que Safari ITP
                        // descartaba al rebotar desde accounts.google.com aun con
                        // JSESSIONID=Lax+Secure, devolviendo [authorization_request_not_found].
                        // Con cookie dedicada (HttpOnly+Secure+Lax, TTL 3 min) el flow
                        // funciona en Safari/Chrome/Firefox/Brave por igual.
                        .authorizationEndpoint(endpoint -> endpoint
                                .authorizationRequestRepository(authorizationRequestRepository))
                        .successHandler(oauth2LoginSuccessHandler)
                        .failureHandler(oauth2LoginFailureHandler));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Antes los dominios estaban hardcodeados. Ahora se leen de
        // cors.allowed-origins (CSV) en application.properties, configurable
        // por env var CORS_ALLOWED_ORIGINS sin redeploy de código.
        config.setAllowedOrigins(parseCsv(allowedOriginsCsv));
        config.setAllowedOriginPatterns(parseCsv(allowedOriginPatternsCsv));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin",
                "X-AS-Captcha-Token", "X-Idempotency-Key"));
        // expose Retry-After. El cliente lo lee en
        // intentarRefresh() para respetar el backoff que indica el backend
        // tras un 503 cross-tab. Sin esto, en producción (cross-origin
        // animeshowdown.dev → api.animeshowdown.dev), headers.get('Retry-After')
        // devuelve null y el fix de grace cae al backoff local — menos
        // preciso y desperdicia la señal del servidor.
        config.setExposedHeaders(List.of("Authorization", "Retry-After"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    private AuthorizationManager<RequestAuthorizationContext> swaggerAuthorizationManager() {
        return (request, ctx) -> {
            if (swaggerExpuestoSinAuth()) {
                return new AuthorizationDecision(true);
            }
            Authentication currentAuth = SecurityContextHolder.getContext().getAuthentication();
            if (currentAuth != null && currentAuth.isAuthenticated()
                    && currentAuth.getAuthorities().stream()
                            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
                return new AuthorizationDecision(true);
            }
            return new AuthorizationDecision(false);
        };
    }

    /**
     * ¿Se expone Swagger/OpenAPI sin autenticación? Fail-closed: solo en perfiles
     * de desarrollo conocidos ({@link #PERFILES_DEV}) o con el override explícito
     * {@code app.swagger.public=true}. En cualquier otro caso —producción, un
     * perfil renombrado (prod/railway/staging), un CSV sin perfil dev, o perfil
     * vacío— exige ROLE_ADMIN.
     *
     * <p>Antes la comprobación era fail-OPEN: solo el string exacto
     * {@code "production"} protegía, así que un rename del perfil o un deploy sin
     * perfil dejaba todo el spec del API público. Nota: en local (perfil vacío)
     * Swagger queda protegido; para abrirlo, arrancar con
     * {@code SPRING_PROFILES_ACTIVE=dev} o {@code APP_SWAGGER_PUBLIC=true}.
     */
    private boolean swaggerExpuestoSinAuth() {
        return perfilExponeSwagger(activeProfile, swaggerPublicOverride);
    }

    /** Lógica pura de {@link #swaggerExpuestoSinAuth()}, extraída para tests. */
    static boolean perfilExponeSwagger(String activeProfile, boolean override) {
        if (override) {
            return true;
        }
        if (activeProfile == null) {
            return false;
        }
        return Arrays.stream(activeProfile.split(","))
                .map(String::trim)
                .map(p -> p.toLowerCase(Locale.ROOT))
                .anyMatch(PERFILES_DEV::contains);
    }

    /** Parsea una lista CSV ignorando espacios y entradas vacías. */
    private static List<String> parseCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
