package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Verifica la validación de configuración de email (A9): el fallo de email
 * transaccional era silencioso (sin RESEND_API_KEY o con el RESEND_FROM de
 * prueba, los usuarios reales no reciben verificación ni reset). Ahora se avisa
 * en boot y, bajo APP_SECRETS_STRICT, aborta el arranque.
 *
 * <p>El validador es {@code @Profile("!test")}, así que en la suite no lo
 * instancia Spring: se construye a mano y se invoca {@code validar()} directo.
 */
class ProductionSecretsValidatorTest {

    // 40 chars: supera el piso de entropía (32) para que solo varíe el email.
    private static final String SECRETO = "0123456789012345678901234567890123456789";

    private ProductionSecretsValidator validador(boolean strict, String resendApiKey, String resendFrom) {
        return new ProductionSecretsValidator(
                strict,
                "db-password-real",
                SECRETO, SECRETO, SECRETO,
                "google-id", "google-secret", "discord-id", "discord-secret",
                false, "",
                "",
                resendApiKey, resendFrom);
    }

    @Test
    void emailBienConfigurado_noLanza() {
        assertThatCode(() -> validador(true, "re_realkey", "noreply@animeshowdown.dev").validar())
                .doesNotThrowAnyException();
    }

    @Test
    void sinApiKey_enModoLaxo_soloLogueaNoAborta() {
        assertThatCode(() -> validador(false, "", "noreply@animeshowdown.dev").validar())
                .doesNotThrowAnyException();
    }

    @Test
    void sinApiKey_enModoStricto_abortaBoot() {
        assertThatThrownBy(() -> validador(true, "", "noreply@animeshowdown.dev").validar())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESEND_API_KEY");
    }

    @Test
    void remitenteDePrueba_enModoStricto_abortaBoot() {
        assertThatThrownBy(() -> validador(true, "re_realkey", "onboarding@resend.dev").validar())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESEND_FROM");
    }

    @Test
    void remitenteVacio_enModoStricto_abortaBoot() {
        assertThatThrownBy(() -> validador(true, "re_realkey", "").validar())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESEND_FROM");
    }
}
