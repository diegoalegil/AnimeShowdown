package com.diegoalegil.animeshowdown.model;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "usuarios", indexes = {
        // El UNIQUE de username/email ya genera índice implícito en Postgres,
        // pero declararlo explícitamente con nombre estable facilita
        // migraciones futuras (Flyway) y deja claro qué columnas son hot path
        // de queries (login por username, lookup por email).
        @Index(name = "idx_usuarios_email", columnList = "email"),
        @Index(name = "idx_usuarios_username", columnList = "username")
})
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String avatarUrl;

    /**
     * Banner/cabecera del perfil (V35). Imagen subida por el usuario —mismo
     * pipeline que el avatar: data URI base64 o URL pública, sin R2—. NULL =
     * el usuario no ha configurado uno; en ese caso /perfil, /u/{username} y la
     * OG hacen fallback al arte del personaje favorito (nunca queda genérico).
     */
    @Column(name = "banner_url", columnDefinition = "TEXT")
    private String bannerUrl;

    /**
     * Bio pública corta (B7 §1a). Texto plano —el backend hace strip de HTML
     * antes de persistir—, máx 240 chars. NULL = el usuario aún no la ha
     * escrito; el frontend pinta el perfil sin romper layout en ese caso.
     */
    @Column(length = 240)
    private String bio;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rol rol;

    @Column(nullable = false)
    private LocalDateTime fechaRegistro;

    /**
     * Cuenta de logins fallidos consecutivos. Se resetea a 0
     * en cada login exitoso. Si llega a 5, el AuthController setea
     * bloqueadoHasta = now + 15min y reincia el contador.
     */
    @Column(name = "intentos_fallidos", nullable = false, columnDefinition = "INTEGER DEFAULT 0")
    private Integer intentosFallidos = 0;

    @JsonIgnore
    @Column(name = "token_version", nullable = false, columnDefinition = "INTEGER DEFAULT 0")
    private Integer tokenVersion = 0;

    /**
     * Si está seteado y es futuro, los logins responden 423 Locked sin
     * comprobar password. null = cuenta normal. Lo desactivamos automático
     * cuando se expira (no necesita unlock manual).
     */
    @Column(name = "bloqueado_hasta")
    private LocalDateTime bloqueadoHasta;

    /**
     * Verificación de email. PENDIENTE tras /registro hasta
     * que el usuario clica el link recibido por email; ACTIVO tras
     * verificar. Los usuarios pre-existentes (creados antes de §2.4)
     * arrancan con ACTIVO por el default en V2.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "estado_verificacion", nullable = false, length = 20)
    private EstadoVerificacion estadoVerificacion = EstadoVerificacion.ACTIVO;

    /**
     * Secret TOTP activo cifrado. null = el usuario NO tiene
     * 2FA activado. Se almacena cifrado con AES (clave en env var
     * TOTP_ENCRYPTION_KEY) — si la BBDD se filtra sin el.env, los secrets
     * son inútiles. TotpService cifra/descifra al leer/escribir.
     */
    @JsonIgnore
    @Column(name = "totp_secret")
    private String totpSecret;

    /**
     * Secret pendiente de verificar tras /2fa/setup pero antes de /2fa/enable.
     * El usuario ya lo escaneó del QR pero todavía no ha enviado un código
     * válido — promueve a totpSecret en cuanto valide. Si abandona el flow,
     * queda huérfano hasta el siguiente /2fa/setup (que lo sobrescribe).
     */
    @JsonIgnore
    @Column(name = "totp_secret_pendiente")
    private String totpSecretPendiente;

    /**
     * Flag explícito: el usuario completó el flow de setup y todo login
     * futuro pasará por el paso de TOTP. Independiente de "secret != null"
     * porque en flows futuros (recovery pausado) podríamos querer
     * desactivar 2FA temporalmente sin perder el secret.
     */
    @Column(name = "totp_habilitado", nullable = false)
    private Boolean totpHabilitado = false;

    /**
     * Fecha en la que el 2FA se activó. Solo informativo — la UI puede
     * mostrar "2FA activo desde 12 de marzo".
     */
    @Column(name = "totp_habilitado_en")
    private LocalDateTime totpHabilitadoEn;

    /**
     * Código único de referral. Se genera en el
     * registro y nunca cambia. 8 chars alfanuméricos. Sirve para que
     * otros usuarios se registren con {@code ?ref={code}} y queden
     * vinculados como referidos del dueño del código.
     *
     * <p>Nullable solo durante el backfill de usuarios pre-V14; tras
     * el primer arranque está siempre presente para usuarios nuevos.
     */
    @Column(name = "referral_code", length = 8, unique = true)
    private String referralCode;

    /**
     * Usuario referrer que invitó a éste con su código.
     * Null para registros directos. FK con ON DELETE SET NULL para
     * preservar el referido si el referrer borra su cuenta.
     */
    @jakarta.persistence.ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @jakarta.persistence.JoinColumn(name = "referred_by_user_id")
    private Usuario referredBy;

    @Column(name = "elo_pvp", nullable = false, columnDefinition = "INTEGER DEFAULT 1000")
    private Integer eloPvp = 1000;

    @Column(name = "pvp_partidos", nullable = false, columnDefinition = "INTEGER DEFAULT 0")
    private Integer pvpPartidos = 0;

    /**
     * V-8: el usuario ya pasó (o saltó) el onboarding post-login donde
     * elige username + avatar. Las cuentas OAuth nacen en false (username
     * autogenerado) y disparan el modal una vez; los registros por
     * formulario nacen en true porque ya eligieron su username. El frontend
     * lee {@code needsOnboarding = !onboardingCompletado} desde /me.
     */
    @Column(name = "onboarding_completado", nullable = false)
    private Boolean onboardingCompletado = false;

    /** V64: fecha en que el usuario abrió su sobre de bienvenida. Null = no reclamado. */
    @Column(name = "sobre_bienvenida_reclamado_en")
    private java.time.LocalDateTime sobreBienvenidaReclamadoEn;

    public java.time.LocalDateTime getSobreBienvenidaReclamadoEn() {
        return sobreBienvenidaReclamadoEn;
    }

    public void setSobreBienvenidaReclamadoEn(java.time.LocalDateTime sobreBienvenidaReclamadoEn) {
        this.sobreBienvenidaReclamadoEn = sobreBienvenidaReclamadoEn;
    }

    public Usuario() {
    }

    public Usuario(String username, String password, String email) {
        this.username = username;
        this.password = password;
        this.email = email;
        this.rol = Rol.USER;
        this.fechaRegistro = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.fechaRegistro == null) {
            this.fechaRegistro = LocalDateTime.now();
        }
        if (this.rol == null) {
            this.rol = Rol.USER;
        }
        if (this.tokenVersion == null) {
            this.tokenVersion = 0;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getBannerUrl() {
        return bannerUrl;
    }

    public void setBannerUrl(String bannerUrl) {
        this.bannerUrl = bannerUrl;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public Rol getRol() {
        return rol;
    }

    public void setRol(Rol rol) {
        this.rol = rol;
    }

    public LocalDateTime getFechaRegistro() {
        return fechaRegistro;
    }

    public void setFechaRegistro(LocalDateTime fechaRegistro) {
        this.fechaRegistro = fechaRegistro;
    }

    public Integer getIntentosFallidos() {
        return intentosFallidos == null ? 0 : intentosFallidos;
    }

    public void setIntentosFallidos(Integer intentosFallidos) {
        this.intentosFallidos = intentosFallidos == null ? 0 : intentosFallidos;
    }

    public int getTokenVersion() {
        return tokenVersion == null ? 0 : tokenVersion;
    }

    public void setTokenVersion(Integer tokenVersion) {
        this.tokenVersion = tokenVersion == null ? 0 : tokenVersion;
    }

    public void incrementarTokenVersion() {
        this.tokenVersion = getTokenVersion() + 1;
    }

    public LocalDateTime getBloqueadoHasta() {
        return bloqueadoHasta;
    }

    public void setBloqueadoHasta(LocalDateTime bloqueadoHasta) {
        this.bloqueadoHasta = bloqueadoHasta;
    }

    /** True si la cuenta tiene un bloqueo activo (no expirado). */
    public boolean estaBloqueado() {
        return bloqueadoHasta != null && bloqueadoHasta.isAfter(LocalDateTime.now());
    }

    public EstadoVerificacion getEstadoVerificacion() {
        return estadoVerificacion == null ? EstadoVerificacion.PENDIENTE : estadoVerificacion;
    }

    public void setEstadoVerificacion(EstadoVerificacion estadoVerificacion) {
        this.estadoVerificacion = estadoVerificacion;
    }

    /** True si el usuario verificó email — habilitado para votar/crear torneos. */
    public boolean estaVerificado() {
        return getEstadoVerificacion() == EstadoVerificacion.ACTIVO;
    }

    public String getTotpSecret() {
        return totpSecret;
    }

    public void setTotpSecret(String totpSecret) {
        this.totpSecret = totpSecret;
    }

    public String getTotpSecretPendiente() {
        return totpSecretPendiente;
    }

    public void setTotpSecretPendiente(String totpSecretPendiente) {
        this.totpSecretPendiente = totpSecretPendiente;
    }

    public boolean isTotpHabilitado() {
        return totpHabilitado != null && totpHabilitado;
    }

    public void setTotpHabilitado(boolean totpHabilitado) {
        this.totpHabilitado = totpHabilitado;
    }

    public LocalDateTime getTotpHabilitadoEn() {
        return totpHabilitadoEn;
    }

    public void setTotpHabilitadoEn(LocalDateTime totpHabilitadoEn) {
        this.totpHabilitadoEn = totpHabilitadoEn;
    }

    public String getReferralCode() {
        return referralCode;
    }

    public void setReferralCode(String referralCode) {
        this.referralCode = referralCode;
    }

    public Usuario getReferredBy() {
        return referredBy;
    }

    public void setReferredBy(Usuario referredBy) {
        this.referredBy = referredBy;
    }

    public Integer getEloPvpRaw() {
        return eloPvp;
    }

    public int getEloPvp() {
        return eloPvp == null ? 1000 : eloPvp;
    }

    public void setEloPvp(Integer eloPvp) {
        this.eloPvp = eloPvp == null ? 1000 : eloPvp;
    }

    public Integer getPvpPartidosRaw() {
        return pvpPartidos;
    }

    public int getPvpPartidos() {
        return pvpPartidos == null ? 0 : pvpPartidos;
    }

    public void setPvpPartidos(Integer pvpPartidos) {
        this.pvpPartidos = pvpPartidos == null ? 0 : pvpPartidos;
    }

    public boolean isOnboardingCompletado() {
        return onboardingCompletado != null && onboardingCompletado;
    }

    public void setOnboardingCompletado(boolean onboardingCompletado) {
        this.onboardingCompletado = onboardingCompletado;
    }

}
