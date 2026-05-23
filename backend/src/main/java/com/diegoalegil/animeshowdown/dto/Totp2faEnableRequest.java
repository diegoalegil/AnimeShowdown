package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Body de POST /api/auth/2fa/enable.
 *
 * <p>El cliente envía el código de 6 dígitos de su app authenticator
 * (Google Authenticator / Authy / 1Password /...) para que el backend
 * valide contra el secret pendiente. Si OK, el secret pendiente se
 * promueve a activo y el 2FA queda habilitado.
 */
public class Totp2faEnableRequest {

    @NotBlank(message = "El código es obligatorio")
    @Pattern(regexp = "\\d{6}", message = "El código debe ser de 6 dígitos")
    private String codigo;

    public Totp2faEnableRequest() {
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }
}
