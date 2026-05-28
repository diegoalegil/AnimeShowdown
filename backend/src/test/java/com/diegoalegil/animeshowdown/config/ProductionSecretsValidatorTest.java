package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Unit tests for ProductionSecretsValidator.
 *
 * <p>The validator is only active under {@code @Profile("!test")}, so it cannot
 * be instantiated in a normal @SpringBootTest context. These tests construct
 * it directly with known-safe values to exercise the constructor logic.
 */
class ProductionSecretsValidatorTest {

    @Test
    void allSecretsConfiguredDoesNotThrow() {
        assertThatCode(() -> new ProductionSecretsValidator(
                "real-db-password",
                "real-jwt-secret-32-chars-minimum",
                "real-totp-key-32-chars",
                "real-anon-hmac-key",
                "", "", "", "", // OAuth optional
                false, ""       // Turnstile disabled
        )).doesNotThrowAnyException();
    }

    @Test
    void requiredSecretWithPlaceholderThrows() {
        assertThatThrownBy(() -> new ProductionSecretsValidator(
                "CHANGE_ME_DB_PASSWORD",
                "real-jwt-secret-32-chars-minimum",
                "real-totp-key-32-chars",
                "real-anon-hmac-key",
                "", "", "", "",
                false, ""
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void requiredSecretEmptyThrows() {
        assertThatThrownBy(() -> new ProductionSecretsValidator(
                "",
                "real-jwt-secret-32-chars-minimum",
                "real-totp-key-32-chars",
                "real-anon-hmac-key",
                "", "", "", "",
                false, ""
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void turnstileEnabledWithoutSecretThrows() {
        assertThatThrownBy(() -> new ProductionSecretsValidator(
                "real-db-password",
                "real-jwt-secret-32-chars-minimum",
                "real-totp-key-32-chars",
                "real-anon-hmac-key",
                "", "", "", "",
                true, "" // Turnstile enabled but no secret
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void turnstileEnabledWithSecretDoesNotThrow() {
        assertThatCode(() -> new ProductionSecretsValidator(
                "real-db-password",
                "real-jwt-secret-32-chars-minimum",
                "real-totp-key-32-chars",
                "real-anon-hmac-key",
                "", "", "", "",
                true, "real-turnstile-secret"
        )).doesNotThrowAnyException();
    }

    @Test
    void optionalOAuthPlaceholderDoesNotThrow() {
        // Optional secrets should not abort boot
        assertThatCode(() -> new ProductionSecretsValidator(
                "real-db-password",
                "real-jwt-secret-32-chars-minimum",
                "real-totp-key-32-chars",
                "real-anon-hmac-key",
                "CHANGE_ME_GOOGLE_CLIENT_ID",
                "CHANGE_ME_GOOGLE_CLIENT_SECRET",
                "CHANGE_ME_DISCORD_CLIENT_ID",
                "CHANGE_ME_DISCORD_CLIENT_SECRET",
                false, ""
        )).doesNotThrowAnyException();
    }
}
