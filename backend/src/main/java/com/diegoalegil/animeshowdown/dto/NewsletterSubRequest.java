package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Body de POST /api/newsletter (Plan v2 §4.8). El backend además normaliza
 * a lowercase + trim antes de buscar/insertar.
 */
public class NewsletterSubRequest {

    @NotBlank(message = "email es obligatorio")
    @Email(message = "email no válido")
    private String email;

    public NewsletterSubRequest() {}

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
