package com.diegoalegil.animeshowdown.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Beans de infraestructura de la aplicación que no justifican una @Configuration
 * propia cada uno. Fusiona los antiguos TimeConfig (Clock) y PasswordConfig
 * (PasswordEncoder).
 *
 * <p>El {@link PasswordEncoder} vive AQUÍ y no en SecurityConfig a propósito: así
 * los consumidores (AuthController, PerfilService, PasswordResetService…) lo
 * inyectan sin arrastrar SecurityConfig, evitando el ciclo
 * SecurityConfig ↔ PasswordEncoder que motivó la separación original.
 */
@Configuration
public class AppConfig {

    /** Reloj de la zona de producto (app.product-zone, default UTC). */
    @Bean
    public Clock clock(@Value("${app.product-zone:UTC}") String productZone) {
        return Clock.system(ZoneId.of(productZone));
    }

    /** Hash de contraseñas (BCrypt). */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
