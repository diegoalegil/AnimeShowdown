package com.diegoalegil.animeshowdown.dto;

/**
 * Proyección ligera para el sitemap de usuarios.
 * Solo username + fechaRegistro — evita cargar password, email, TOTP,
 * avatarUrl y todos los demás campos de la entidad {@code Usuario}.
 */
public record UsuarioSitemapDto(
        String username,
        java.time.LocalDateTime fechaRegistro) {

    public String lastmod() {
        return fechaRegistro == null ? "" : fechaRegistro.toString();
    }
}