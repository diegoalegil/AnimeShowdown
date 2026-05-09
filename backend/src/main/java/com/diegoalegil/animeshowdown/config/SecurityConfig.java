package com.diegoalegil.animeshowdown.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/personajes/**").permitAll()
                .requestMatchers("/api/votos/**").permitAll()
                .requestMatchers("/api/torneos/**").permitAll()
                .anyRequest().authenticated()
            );
        
        return http.build();
    }
}