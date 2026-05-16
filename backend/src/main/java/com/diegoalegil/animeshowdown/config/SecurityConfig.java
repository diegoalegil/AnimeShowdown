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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.diegoalegil.animeshowdown.security.JwtAuthFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final com.diegoalegil.animeshowdown.security.RateLimitFilter rateLimitFilter;
    private final String allowedOriginsCsv;
    private final String allowedOriginPatternsCsv;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            com.diegoalegil.animeshowdown.security.RateLimitFilter rateLimitFilter,
            @Value("${cors.allowed-origins:}") String allowedOriginsCsv,
            @Value("${cors.allowed-origin-patterns:}") String allowedOriginPatternsCsv) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.rateLimitFilter = rateLimitFilter;
        this.allowedOriginsCsv = allowedOriginsCsv;
        this.allowedOriginPatternsCsv = allowedOriginPatternsCsv;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml",
                                "/swagger-ui.html", "/swagger-ui/**", "/swagger-resources/**", "/webjars/**")
                        .permitAll()
                        // Plan v2 §2.13: endpoint STOMP/WebSocket. El handshake
                        // HTTP es público; la autenticación se hace en el frame
                        // CONNECT con JWT (ver WebSocketConfig.JwtAuthChannelInterceptor).
                        .requestMatchers("/ws", "/ws/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/personajes/*/votar").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/enfrentamientos/*/votar").authenticated()
                        // Lectura pública para que VotarPage pueda mostrar el match aleatorio
                        // antes de pedir login (el voto sí requiere auth, regla de arriba).
                        .requestMatchers(HttpMethod.GET, "/api/enfrentamientos/**").permitAll()
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
                        .requestMatchers(HttpMethod.GET, "/api/logros").permitAll()
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
                .addFilterAfter(jwtAuthFilter, com.diegoalegil.animeshowdown.security.RateLimitFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
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
        config.setExposedHeaders(List.of("Authorization"));
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
