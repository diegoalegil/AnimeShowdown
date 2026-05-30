package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;

public class UsuarioRespuesta {

    private Long id;
    private String username;
    private String email;
    private String avatarUrl;
    private String bio;
    private Rol rol;
    /**
     * Estado de verificación de email. El frontend lo usa
     * para decidir si pintar el banner "Verifica tu email" y bloquear
     * acciones que requieren ACTIVO (votar, crear torneos).
     */
    private EstadoVerificacion estadoVerificacion;
    /**
     * 2FA TOTP activo. El frontend lo usa en /perfil para
     * mostrar "Activar 2FA" vs "Desactivar 2FA" sin pedir info al usuario.
     */
    private boolean totpHabilitado;
    private int eloPvp;
    private int pvpPartidos;
    /**
     * V-8: true mientras el usuario no haya pasado/saltado el onboarding
     * (username + avatar). El frontend lo usa para disparar el OnboardingModal
     * una sola vez tras el primer login OAuth.
     */
    private boolean needsOnboarding;

    public UsuarioRespuesta(Usuario usuario) {
        this.id = usuario.getId();
        this.username = usuario.getUsername();
        this.email = usuario.getEmail();
        this.avatarUrl = usuario.getAvatarUrl();
        this.bio = usuario.getBio();
        this.rol = usuario.getRol();
        this.estadoVerificacion = usuario.getEstadoVerificacion();
        this.totpHabilitado = usuario.isTotpHabilitado();
        this.eloPvp = usuario.getEloPvp();
        this.pvpPartidos = usuario.getPvpPartidos();
        this.needsOnboarding = !usuario.isOnboardingCompletado();
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getAvatarUrl() { return avatarUrl; }
    public String getBio() { return bio; }
    public Rol getRol() { return rol; }
    public EstadoVerificacion getEstadoVerificacion() { return estadoVerificacion; }
    public boolean isTotpHabilitado() { return totpHabilitado; }
    public int getEloPvp() { return eloPvp; }
    public int getPvpPartidos() { return pvpPartidos; }
    public boolean isNeedsOnboarding() { return needsOnboarding; }
}
