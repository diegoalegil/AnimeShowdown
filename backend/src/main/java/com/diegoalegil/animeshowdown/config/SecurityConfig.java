package com.diegoalegil.animeshowdown.config;

import java.util.List;

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

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
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
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/personajes/*/votar").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/enfrentamientos/*/votar").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/personajes/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/personajes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/torneos/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/torneos/**").hasRole("ADMIN")
                        .requestMatchers("/api/votos/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://localhost:3000",
                "https://animeshowdown.vercel.app",
                "https://animeshowdown.pages.dev"));
        config.setAllowedOriginPatterns(List.of(
                "https://animeshowdown-*.vercel.app",
                "https://*.animeshowdown.pages.dev"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
