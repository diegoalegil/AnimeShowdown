package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Body de POST /api/newsletter. El backend además normaliza
 * a lowercase + trim antes de buscar/insertar.
 */
public record NewsletterSubRequest(
        @NotBlank(message = "email es obligatorio")
        @Email(message = "email no válido")
        String email
) { }
