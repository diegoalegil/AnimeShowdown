package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Verifica que la exposición de Swagger/OpenAPI es fail-closed: solo perfiles
 * de desarrollo conocidos o el override explícito la abren sin auth. El resto
 * (producción, perfiles renombrados, vacío, CSV sin dev) exige ROLE_ADMIN.
 */
class SecurityConfigSwaggerTest {

    @Test
    void perfilesDevExponenSwagger() {
        assertThat(SecurityConfig.perfilExponeSwagger("dev", false)).isTrue();
        assertThat(SecurityConfig.perfilExponeSwagger("local", false)).isTrue();
        assertThat(SecurityConfig.perfilExponeSwagger("test", false)).isTrue();
        assertThat(SecurityConfig.perfilExponeSwagger("DEV", false)).isTrue(); // case-insensitive
        assertThat(SecurityConfig.perfilExponeSwagger("production,dev", false)).isTrue(); // CSV con dev
    }

    @Test
    void produccionYperfilesNoDevQuedanProtegidos() {
        assertThat(SecurityConfig.perfilExponeSwagger("production", false)).isFalse();
        // Estos eran los fail-OPEN del codigo anterior (solo "production" exacto protegia):
        assertThat(SecurityConfig.perfilExponeSwagger("prod", false)).isFalse();
        assertThat(SecurityConfig.perfilExponeSwagger("railway", false)).isFalse();
        assertThat(SecurityConfig.perfilExponeSwagger("staging", false)).isFalse();
        assertThat(SecurityConfig.perfilExponeSwagger("production,railway", false)).isFalse();
    }

    @Test
    void perfilVacioONuloQuedaProtegido() {
        assertThat(SecurityConfig.perfilExponeSwagger("", false)).isFalse();
        assertThat(SecurityConfig.perfilExponeSwagger("   ", false)).isFalse();
        assertThat(SecurityConfig.perfilExponeSwagger(null, false)).isFalse();
    }

    @Test
    void overrideExplicitoAbreEnCualquierPerfil() {
        assertThat(SecurityConfig.perfilExponeSwagger("production", true)).isTrue();
        assertThat(SecurityConfig.perfilExponeSwagger("", true)).isTrue();
    }
}
