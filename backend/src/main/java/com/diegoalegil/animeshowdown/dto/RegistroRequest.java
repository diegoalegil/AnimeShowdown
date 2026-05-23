package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class RegistroRequest {

    // el username ahora se restringe a alfanumérico +
    // _ y -. Antes solo se validaba tamaño, así que un cliente directo
    // podía registrar usernames con comillas, slashes, espacios, emoji o
    // Unicode raro. Eso reventaba downstream — p. ej. SeguidorService
    // construye JSON manualmente con el username y un username con
    // {"}{ rompía el payload del WS de notificaciones. El regex también
    // simplifica URLs públicas /u/{username}.
    @NotBlank(message = "El username es obligatorio")
    @Size(min = 3, max = 30, message = "El username debe tener entre 3 y 30 caracteres")
    @Pattern(
            regexp = "^[A-Za-z0-9_-]+$",
            message = "El username solo puede contener letras, números, guión y guión bajo")
    private String username;

    // 5: mínimo 8 chars, al menos una letra y un dígito. Antes
    // permitía "123456" — passwords triviales que rompen al primer ataque
    // automatizado. La regex es deliberadamente permisiva con caracteres
    // especiales (Unicode, símbolos) para no frustrar a usuarios que ya
    // usan passphrases buenas — el zxcvbn del frontend hace el filtrado
    // fino con feedback visual.
    @NotBlank(message = "La password es obligatoria")
    @Size(min = 8, max = 100, message = "La password debe tener entre 8 y 100 caracteres")
    @Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,100}$",
            message = "La password debe incluir al menos una letra y un número")
    private String password;

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "El email no tiene formato válido")
    private String email;

    /**
     * 8: si se envía un código válido (8 chars), el usuario
     * registrado queda vinculado como referido del dueño del código.
     * Opcional — registros sin código siguen funcionando.
     */
    @Size(max = 16, message = "El código de referral es demasiado largo")
    private String referralCode;

    public RegistroRequest() {
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getReferralCode() {
        return referralCode;
    }

    public void setReferralCode(String referralCode) {
        this.referralCode = referralCode;
    }

}
