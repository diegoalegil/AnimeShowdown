package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body de POST /api/auth/2fa/verify-login — paso 2 del login con 2FA.
 *
 * <p>Tras un /login con password OK y 2FA habilitado, el backend devuelve
 * un challengeToken temporal (60s). El cliente vuelve con este DTO:
 * <ul>
 *   <li><code>challengeToken</code>: el devuelto por /login.</li>
 *   <li><code>codigo</code>: 6 dígitos (TOTP) o 10 chars (backup code).
 *       El backend detecta el formato y prueba ambos.</li>
 * </ul>
 *
 * <p>El campo "codigo" no lleva @Pattern porque puede ser TOTP (6 dígitos)
 * o backup code (10 chars alfanuméricos). La validación de formato vive
 * en {@link com.diegoalegil.animeshowdown.service.TotpService#validarCodigo}
 * y en {@link com.diegoalegil.animeshowdown.service.TotpBackupCodeService#consumirSiCoincide}.
 */
public record Totp2faVerifyLoginRequest(

        @NotBlank(message = "El challenge token es obligatorio")
        String challengeToken,

        @NotBlank(message = "El código es obligatorio")
        String codigo) {
}
