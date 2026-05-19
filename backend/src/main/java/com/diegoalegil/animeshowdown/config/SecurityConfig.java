package com.diegoalegil.animeshowdown.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.diegoalegil.animeshowdown.security.JwtAuthFilter;
import com.diegoalegil.animeshowdown.security.OAuth2LoginFailureHandler;
import com.diegoalegil.animeshowdown.security.OAuth2LoginSuccessHandler;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final com.diegoalegil.animeshowdown.security.RateLimitFilter rateLimitFilter;
    private final OAuth2LoginSuccessHandler oauth2LoginSuccessHandler;
    private final OAuth2LoginFailureHandler oauth2LoginFailureHandler;
    private final String allowedOriginsCsv;
    private final String allowedOriginPatternsCsv;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            com.diegoalegil.animeshowdown.security.RateLimitFilter rateLimitFilter,
            OAuth2LoginSuccessHandler oauth2LoginSuccessHandler,
            OAuth2LoginFailureHandler oauth2LoginFailureHandler,
            @Value("${cors.allowed-origins:}") String allowedOriginsCsv,
            @Value("${cors.allowed-origin-patterns:}") String allowedOriginPatternsCsv) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.rateLimitFilter = rateLimitFilter;
        this.oauth2LoginSuccessHandler = oauth2LoginSuccessHandler;
        this.oauth2LoginFailureHandler = oauth2LoginFailureHandler;
        this.allowedOriginsCsv = allowedOriginsCsv;
        this.allowedOriginPatternsCsv = allowedOriginPatternsCsv;
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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml",
                                "/swagger-ui.html", "/swagger-ui/**", "/swagger-resources/**", "/webjars/**")
                        .permitAll()
                        // Plan v2 §2.13: endpoint STOMP/WebSocket. El handshake
                        // HTTP es público; la autenticación se hace en el frame
                        // CONNECT con JWT (ver WebSocketConfig.JwtAuthChannelInterceptor).
                        .requestMatchers("/ws", "/ws/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // Audit P2.10: /api/cron/** se autentica con
                        // X-Cron-Secret header (no JWT), así el GitHub
                        // Action no necesita login que falla si el admin
                        // tiene 2FA. La validación del secret se hace en
                        // CronTorneoController.
                        .requestMatchers("/api/cron/**").permitAll()
                        // Audit P3 (2026-05-18): POST /api/personajes/*/votar
                        // está deshabilitado (devuelve 410 GONE en el controller).
                        // Antes requería auth → clientes anónimos veían 401, no
                        // el 410 que comunica explícitamente la deprecación.
                        // Lo hacemos público para que el 410 llegue siempre.
                        .requestMatchers(HttpMethod.POST, "/api/personajes/*/votar").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/enfrentamientos/*/votar").authenticated()
                        // Lectura pública para que VotarPage pueda mostrar el match aleatorio
                        // antes de pedir login (el voto sí requiere auth, regla de arriba).
                        .requestMatchers(HttpMethod.GET, "/api/enfrentamientos/**").permitAll()
                        // Plan producto (2026-05-18): Mi roster / favoritos.
                        // Estas rutas tienen que aparecer ANTES de las reglas
                        // generales de /api/personajes/** porque Spring
                        // Security matchea por orden. Sin esto, POST/DELETE
                        // /favorito caía en hasRole("ADMIN") y se rechazaba
                        // a usuarios normales.
                        .requestMatchers(HttpMethod.GET, "/api/personajes/*/favorito").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/personajes/*/favorito").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/personajes/*/favorito").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/me/favoritos").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/personajes/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/torneos/mios").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/torneos/**").permitAll()
                        // Plan v2 §4.9: torneos creados por usuario verificado.
                        // POST /mio es autenticado normal; el service valida
                        // la verificación de email. El resto de POST/PUT/DELETE
                        // sobre /api/torneos sigue siendo admin-only.
                        .requestMatchers(HttpMethod.POST, "/api/torneos/mio").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers("/api/votos/**").permitAll()
                        // Plan v2 §4.2: catálogo de badges público (cacheable
                        // long-term en frontend); /mios requiere auth para
                        // saber a qué usuario pertenecen los desbloqueos.
                        // §4.10: /stats agregado por badge es público — alimenta
                        // la página /logros con la rareza real de la comunidad.
                        .requestMatchers(HttpMethod.GET, "/api/logros").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/logros/stats").permitAll()
                        .requestMatchers("/api/logros/mios").authenticated()
                        // Plan v2 §4.3: reactions emoji. GET público (todos
                        // ven los counts); POST autenticado (1 reaction por
                        // user-target con lógica toggle/swap en el service).
                        .requestMatchers(HttpMethod.GET, "/api/reacciones").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/reacciones").authenticated()
                        // Plan v2 §4.4: predicciones de bracket. Leaderboard
                        // público (top predictores); /mias y POST autenticados.
                        .requestMatchers(HttpMethod.GET, "/api/predicciones/leaderboard").permitAll()
                        .requestMatchers("/api/predicciones/**").authenticated()
                        // Plan v2 §4.8: newsletter con double opt-in. Todo
                        // público — form en footer y links de confirmación
                        // /unsubscribe llegan al email del user sin auth.
                        .requestMatchers("/api/newsletter/**").permitAll()
                        // Plan v2 §4.5: friends / follow. GET de listas y
                        // stats es público (perfiles ajenos). POST/DELETE
                        // requiere ser el seguidor (auth).
                        .requestMatchers(HttpMethod.GET, "/api/seguidores/usuario/**").permitAll()
                        .requestMatchers("/api/seguidores/**").authenticated()
                        // Plan v2 §4.5: perfil público por username. /me/** son
                        // del usuario autenticado (historial privado, etc).
                        // /api/perfil/{username} muestra stats + top + logros
                        // públicos sin necesidad de login.
                        .requestMatchers(HttpMethod.GET, "/api/perfil/me/**").authenticated()
                        // Plan v2 §4.1: DELETE /api/perfil/me (GDPR right to
                        // erasure). Requiere sesión + reconfirmación de password
                        // en el body.
                        .requestMatchers(HttpMethod.DELETE, "/api/perfil/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/perfil/*").permitAll()
                        // OG images server-side (Plan v2 §1.2): los PNG los consumen
                        // crawlers anónimos de Twitter/Discord/Slack/etc, sin auth.
                        .requestMatchers(HttpMethod.GET, "/api/og/**").permitAll()
                        // Datos para sitemap dinámico (Plan v2 §5.4). Consumido por
                        // el script generate-sitemap.mjs en build de Cloudflare
                        // Pages; público porque sitemaps son públicos por definición.
                        .requestMatchers(HttpMethod.GET, "/api/sitemap/**").permitAll()
                        .requestMatchers("/api/auth/me", "/api/auth/me/**").authenticated()
                        .requestMatchers("/api/auth/**").permitAll()
                        .anyRequest().authenticated())
                // rateLimitFilter va ANTES del jwtAuthFilter para que las
                // peticiones bloqueadas con 429 no consuman recursos parseando
                // JWT. jwtAuthFilter sigue corriendo en peticiones permitidas.
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(jwtAuthFilter, com.diegoalegil.animeshowdown.security.RateLimitFilter.class)
                .oauth2Login(oauth -> oauth
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
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin"));
        // Audit P2 (2026-05-18): expose Retry-After. El cliente lo lee en
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

    /** Parsea una lista CSV ignorando espacios y entradas vacías. */
    private static List<String> parseCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
