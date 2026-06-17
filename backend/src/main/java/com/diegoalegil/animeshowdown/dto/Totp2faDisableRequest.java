package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body de POST /api/auth/2fa/disable.
 *
 * <p>Para desactivar 2FA pedimos AMBAS cosas:
 * <ul>
 *   <li>password actual — confirma que el usuario está físicamente en la
 *       sesión (no es alguien con la pantalla desbloqueada).</li>
 *   <li>código TOTP actual — confirma que el dispositivo authenticator
 *       sigue siendo legítimamente del usuario.</li>
 * </ul>
 *
 * <p>Si el usuario perdió el authenticator, debe entrar con backup code y
 * desde dentro generar set nuevo o desactivar 2FA por otro flow.
 */
public record Totp2faDisableRequest(

        @NotBlank(message = "La contraseña es obligatoria")
        String password,

        @NotBlank(message = "El código es obligatorio")
        String codigo) {
}
