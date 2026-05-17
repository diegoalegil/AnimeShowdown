package com.diegoalegil.animeshowdown.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.diegoalegil.animeshowdown.dto.CambioPasswordRequest;
import com.diegoalegil.animeshowdown.dto.ForgotPasswordRequest;
import com.diegoalegil.animeshowdown.dto.LoginRequest;
import com.diegoalegil.animeshowdown.dto.RegistroRequest;
import com.diegoalegil.animeshowdown.dto.ResetPasswordRequest;
import com.diegoalegil.animeshowdown.dto.TokenRespuesta;
import com.diegoalegil.animeshowdown.dto.Totp2faDisableRequest;
import com.diegoalegil.animeshowdown.dto.Totp2faEnableRequest;
import com.diegoalegil.animeshowdown.dto.Totp2faVerifyLoginRequest;
import com.diegoalegil.animeshowdown.dto.UsuarioRespuesta;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.ClientIpExtractor;
import com.diegoalegil.animeshowdown.security.JwtUtil;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.EmailVerificationService;
import com.diegoalegil.animeshowdown.service.PasswordResetService;
import com.diegoalegil.animeshowdown.service.RefreshTokenService;
import com.diegoalegil.animeshowdown.service.TotpBackupCodeService;
import com.diegoalegil.animeshowdown.service.TotpEncryptor;
import com.diegoalegil.animeshowdown.service.TotpService;
import com.diegoalegil.animeshowdown.service.TwoFactorChallengeService;

import org.springframework.web.bind.annotation.RequestParam;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private static final String REFRESH_COOKIE = "refresh_token";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final PasswordResetService passwordResetService;
    private final RefreshTokenService refreshTokenService;
    private final EmailVerificationService emailVerificationService;
    private final AuditLogService auditLogService;
    private final TotpService totpService;
    private final TotpEncryptor totpEncryptor;
    private final TwoFactorChallengeService twoFactorChallengeService;
    private final TotpBackupCodeService totpBackupCodeService;
    private final Set<String> adminEmails;
    private final boolean cookieSecure;

    public AuthController(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            PasswordResetService passwordResetService,
            RefreshTokenService refreshTokenService,
            EmailVerificationService emailVerificationService,
            AuditLogService auditLogService,
            TotpService totpService,
            TotpEncryptor totpEncryptor,
            TwoFactorChallengeService twoFactorChallengeService,
            TotpBackupCodeService totpBackupCodeService,
            @Value("${admin.emails:diegogildam@gmail.com}") String adminEmailsCsv,
            @Value("${app.refresh-token.cookie-secure:true}") boolean cookieSecure) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.passwordResetService = passwordResetService;
        this.refreshTokenService = refreshTokenService;
        this.emailVerificationService = emailVerificationService;
        this.auditLogService = auditLogService;
        this.totpService = totpService;
        this.totpEncryptor = totpEncryptor;
        this.twoFactorChallengeService = twoFactorChallengeService;
        this.totpBackupCodeService = totpBackupCodeService;
        this.cookieSecure = cookieSecure;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toCollection(HashSet::new));
        log.info("AuthController arrancado con {} email(s) auto-admin, cookieSecure={}",
                adminEmails.size(), cookieSecure);
    }

    // === helpers para cookies de refresh token ===

    private ResponseCookie construirCookieRefresh(String tokenPlano) {
        return ResponseCookie.from(REFRESH_COOKIE, tokenPlano)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(refreshTokenService.getTtl())
                .build();
    }

    private ResponseCookie limpiarCookieRefresh() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
    }

    private String extraerUserAgent(HttpServletRequest req) {
        String ua = req.getHeader("User-Agent");
        if (ua == null) return null;
        return ua.length() > 500 ? ua.substring(0, 500) : ua;
    }

    @PostMapping("/registro")
    public ResponseEntity<?> registro(@Valid @RequestBody RegistroRequest request,
            HttpServletRequest httpRequest) {

        // Normaliza email a lowercase + trim para evitar duplicados por capitalización
        // (Gmail, Outlook etc. tratan emails como case-insensitive — la BBDD también debe)
        String emailNormalizado = request.getEmail() == null ? null : request.getEmail().trim().toLowerCase();

        if (usuarioRepository.findByUsername(request.getUsername()).isPresent()) {
            log.warn("Intento de registro con username ya existente: {}", request.getUsername());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("El username ya existe");
        }

        if (usuarioRepository.findByEmail(emailNormalizado).isPresent()) {
            log.warn("Intento de registro con email ya existente: {}", emailNormalizado);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("El email ya está registrado");
        }

        String passwordHasheado = passwordEncoder.encode(request.getPassword());

        Usuario nuevoUsuario = new Usuario(
                request.getUsername(),
                passwordHasheado,
                emailNormalizado);
        // Plan v2 §2.4: registros nuevos nacen PENDIENTE hasta verificar email.
        // No pueden votar ni crear torneos en este estado.
        nuevoUsuario.setEstadoVerificacion(EstadoVerificacion.PENDIENTE);

        if (emailNormalizado != null && adminEmails.contains(emailNormalizado)) {
            nuevoUsuario.setRol(Rol.ADMIN);
            log.info("Auto-promoción a ADMIN: email={}", emailNormalizado);
        }

        Usuario guardado = usuarioRepository.save(nuevoUsuario);

        // Emite token de verificación + dispara email asíncrono. Si el envío
        // falla, el log queda en EmailService; el usuario verá el banner en
        // el frontend y podrá pedir reenvio.
        emailVerificationService.emitir(guardado);

        log.info("Usuario registrado (PENDIENTE verificación): id={} username={} rol={}",
                guardado.getId(), guardado.getUsername(), guardado.getRol());

        auditLogService.registrar(AuditEvento.REGISTRO, guardado, null, httpRequest);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UsuarioRespuesta(guardado));
    }

    /**
     * Verifica un email vía link recibido por correo. El frontend hace
     * GET /api/auth/verify?token=XXX desde /verify y muestra el resultado.
     * Plan v2 §2.4.
     */
    @GetMapping("/verify")
    public ResponseEntity<?> verifyEmail(@RequestParam String token,
            HttpServletRequest httpRequest) {
        boolean ok = emailVerificationService.verificar(token);
        if (ok) {
            // El service ya logueó la activación; aquí solo auditamos el evento
            // sin saber el usuario (el service lo conoce internamente). Para
            // tener el usuario en el audit hacemos un lookup-light a través
            // del service en el futuro; por ahora dejamos null y el evento.
            auditLogService.registrar(AuditEvento.EMAIL_VERIFICADO, null, null, httpRequest);
            return ResponseEntity.ok(Map.of(
                    "message", "Email verificado correctamente",
                    "verificado", true));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of(
                        "message", "Token inválido o expirado. Pide un reenvío desde la web.",
                        "verificado", false));
    }

    /**
     * Reenvía el email de verificación al usuario autenticado. Requiere
     * estar logueado (JWT válido) — el usuario PENDIENTE sí tiene JWT,
     * solo está restringido para acciones como votar.
     */
    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(@AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (usuario.estaVerificado()) {
            return ResponseEntity.ok(Map.of("message", "Tu email ya está verificado"));
        }
        emailVerificationService.emitir(usuario);
        auditLogService.registrar(AuditEvento.EMAIL_VERIFICATION_REENVIADA, usuario, null, httpRequest);
        return ResponseEntity.ok(Map.of(
                "message", "Hemos enviado un nuevo enlace a tu correo. Revisa la bandeja en unos segundos."));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {

        // Acepta username o email en el campo username (UX: usuario teclea cualquiera)
        String identificador = request.getUsername();
        // Para el lookup por email normalizamos a lowercase porque la BBDD lo guarda así
        // desde el fix de email-case-sensitivity. Username sigue case-sensitive (es identidad).
        String identificadorLower = identificador == null ? null : identificador.trim().toLowerCase();
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(identificador)
                .or(() -> usuarioRepository.findByEmail(identificadorLower));

        if (usuarioOpt.isEmpty()) {
            log.warn("Login fallido (usuario/email no existe): {}", identificador);
            auditLogService.registrar(AuditEvento.LOGIN_FAIL, null,
                    Map.of("identificador", identificador, "razon", "usuario_no_existe"),
                    httpRequest);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        Usuario usuario = usuarioOpt.get();

        // Plan v2 §2.2: account lockout. Si la cuenta está bloqueada por
        // intentos fallidos consecutivos, ni siquiera comprobamos la
        // password (defensa contra ataques que aprovechan timing).
        if (usuario.estaBloqueado()) {
            long minutos = Math.max(1,
                    java.time.Duration.between(java.time.LocalDateTime.now(), usuario.getBloqueadoHasta()).toMinutes());
            log.warn("Login fallido (cuenta bloqueada): username={} minutos_restantes={}",
                    usuario.getUsername(), minutos);
            auditLogService.registrar(AuditEvento.LOGIN_BLOQUEADO, usuario,
                    Map.of("minutosRestantes", minutos), httpRequest);
            return ResponseEntity.status(HttpStatus.LOCKED)
                    .body(Map.of(
                            "message", "Cuenta bloqueada por intentos fallidos. Inténtalo en " + minutos + " min.",
                            "minutosRestantes", minutos));
        }

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            // Incrementa contador. A los 5 fallos consecutivos bloquea 15 min.
            int fallos = usuario.getIntentosFallidos() + 1;
            boolean acabaDeBloquearse = false;
            if (fallos >= 5) {
                usuario.setBloqueadoHasta(java.time.LocalDateTime.now().plusMinutes(15));
                usuario.setIntentosFallidos(0);
                acabaDeBloquearse = true;
                log.warn("Cuenta BLOQUEADA 15min por 5 logins fallidos: username={}", usuario.getUsername());
            } else {
                usuario.setIntentosFallidos(fallos);
            }
            usuarioRepository.save(usuario);
            log.warn("Login fallido (password incorrecta): username={} intentos={}/5",
                    usuario.getUsername(), fallos);
            auditLogService.registrar(AuditEvento.LOGIN_FAIL, usuario,
                    Map.of("intentos", fallos, "razon", "password_incorrecta"), httpRequest);
            if (acabaDeBloquearse) {
                auditLogService.registrar(AuditEvento.CUENTA_BLOQUEADA, usuario,
                        Map.of("minutosDuracion", 15, "razon", "5_logins_fallidos"), httpRequest);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        // Login OK: reset del contador de fallos (limpia historial cualquiera
        // sea su estado previo).
        if (usuario.getIntentosFallidos() > 0 || usuario.getBloqueadoHasta() != null) {
            usuario.setIntentosFallidos(0);
            usuario.setBloqueadoHasta(null);
            usuarioRepository.save(usuario);
        }

        // Plan v2 §2.3: si el usuario tiene 2FA activo, NO emitimos JWT ni
        // refresh todavía. Emitimos un challenge token temporal (60s) que el
        // cliente usará en /2fa/verify-login junto con el código TOTP. El
        // LOGIN_OK del audit se registra solo cuando se complete el paso 2.
        if (usuario.isTotpHabilitado()) {
            TwoFactorChallengeService.Resultado challenge =
                    twoFactorChallengeService.emitir(usuario.getId());
            log.info("Login paso 1 OK, esperando 2FA: username={}", usuario.getUsername());
            return ResponseEntity.ok(TokenRespuesta.challenge2fa(
                    challenge.token(), challenge.expiraEnSegundos()));
        }

        return emitirSesionExitosa(usuario, httpRequest, AuditEvento.LOGIN_OK);
    }

    /**
     * Encapsula el efecto secundario "login completado": emite JWT, emite
     * refresh token, setea la cookie httpOnly, audita y devuelve la
     * TokenRespuesta. Lo llaman tanto el flujo de login sin 2FA como el de
     * /2fa/verify-login.
     */
    private ResponseEntity<TokenRespuesta> emitirSesionExitosa(Usuario usuario,
            HttpServletRequest httpRequest, AuditEvento eventoAudit) {
        String token = jwtUtil.generarToken(usuario);
        String refreshPlano = refreshTokenService.emitir(
                usuario, extraerUserAgent(httpRequest), ClientIpExtractor.extract(httpRequest));
        log.info("Login exitoso: username={} rol={}", usuario.getUsername(), usuario.getRol());
        auditLogService.registrar(eventoAudit, usuario, null, httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, construirCookieRefresh(refreshPlano).toString())
                .body(new TokenRespuesta(token, new UsuarioRespuesta(usuario)));
    }

    /**
     * Rota el refresh token. El cliente envía la cookie automáticamente;
     * el backend la valida, revoca la entrada vieja, emite una nueva, y
     * devuelve un access token JWT fresco + setea la nueva cookie refresh.
     *
     * 401 + cookie limpia si el token está expirado, revocado o no existe
     * (incluye caso de reuse: si llega un revocado, RefreshTokenService
     * mata TODAS las sesiones del usuario como defensa).
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie,
            HttpServletRequest httpRequest) {
        if (refreshCookie == null || refreshCookie.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                    .body(Map.of("message", "No hay sesión activa"));
        }
        Optional<RefreshTokenService.RotarResultado> opt = refreshTokenService.rotar(
                refreshCookie, extraerUserAgent(httpRequest), ClientIpExtractor.extract(httpRequest));
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                    .body(Map.of("message", "Sesión expirada o inválida"));
        }
        RefreshTokenService.RotarResultado r = opt.get();
        String nuevoJwt = jwtUtil.generarToken(r.usuario());
        auditLogService.registrar(AuditEvento.REFRESH_TOKEN_ROTADO, r.usuario(), null, httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, construirCookieRefresh(r.nuevoTokenPlano()).toString())
                .body(new TokenRespuesta(nuevoJwt, new UsuarioRespuesta(r.usuario())));
    }

    /**
     * Revoca el refresh token de la cookie actual y la limpia. El access
     * JWT en memoria del cliente sigue siendo válido hasta que expire (15
     * min máx), pero sin refresh ya no se puede renovar.
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (refreshCookie != null && !refreshCookie.isBlank()) {
            refreshTokenService.revocar(refreshCookie);
        }
        // Audit del logout — usuario puede ser null si el JWT ya expiró pero
        // el cliente está cerrando sesión igualmente; en ese caso registramos
        // sin usuario asociado.
        auditLogService.registrar(AuditEvento.LOGOUT, usuario, null, httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .body(Map.of("message", "Sesión cerrada"));
    }

    /**
     * Revoca TODAS las sesiones del usuario actual ("cerrar sesión en
     * todos los dispositivos"). Requiere estar autenticado con un JWT
     * válido. Limpia también la cookie del dispositivo actual.
     */
    @PostMapping("/revoke-all")
    public ResponseEntity<?> revokeAll(@AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        int n = refreshTokenService.revocarTodos(usuario);
        auditLogService.registrar(AuditEvento.SESIONES_REVOCADAS_TODAS, usuario,
                Map.of("sesionesCerradas", n), httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .body(Map.of("message", "Todas las sesiones cerradas", "sesionesCerradas", n));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal Usuario usuario) {
        // Antes usaba auth.getName() + findByUsername, pero como Usuario no
        // implementa UserDetails, auth.getName() devolvía Object.toString() ("...Usuario@abc")
        // y findByUsername fallaba siempre → 401. JwtAuthFilter ya inyecta la
        // entidad Usuario completa como principal — la usamos directamente.
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(new UsuarioRespuesta(usuario));
    }

    @PutMapping("/me/avatar")
    public ResponseEntity<?> actualizarAvatar(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String avatarUrl = body.get("avatarUrl");
        if (avatarUrl != null && avatarUrl.length() > 500_000) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("avatarUrl demasiado largo (máx 500 KB)");
        }
        usuario.setAvatarUrl(avatarUrl != null && avatarUrl.isBlank() ? null : avatarUrl);
        usuarioRepository.save(usuario);
        log.info("Avatar actualizado: username={}", usuario.getUsername());
        return ResponseEntity.ok(new UsuarioRespuesta(usuario));
    }

    @PutMapping("/me/password")
    public ResponseEntity<?> cambiarPassword(
            @Valid @RequestBody CambioPasswordRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        // Cambio de contraseña con usuario autenticado: requiere current_password
        // para evitar que si alguien deja la sesión abierta otro usuario cambie
        // la pass sin saber la actual (distinto del reset por email que sirve
        // cuando se te olvida la actual).
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), usuario.getPassword())) {
            log.warn("Cambio password fallido (current incorrecta): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "La contraseña actual no coincide"));
        }
        if (request.getNewPassword().equals(request.getCurrentPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "La nueva contraseña debe ser distinta a la actual"));
        }
        usuario.setPassword(passwordEncoder.encode(request.getNewPassword()));
        usuarioRepository.save(usuario);
        // Plan v2 §1.3: invalidar todas las sesiones previas tras cambio de
        // password. Si alguien tenía robada la sesión, el cambio de pass la
        // cierra. El usuario actual también pierde su refresh pero el JWT
        // del access sigue activo hasta los 15min, así que la pantalla no
        // se cae inmediatamente — al siguiente refresh fallará y forzará
        // re-login con la pass nueva.
        int sesionesCerradas = refreshTokenService.revocarTodos(usuario);
        log.info("Password cambiada: username={} (cerradas {} sesiones)",
                usuario.getUsername(), sesionesCerradas);
        auditLogService.registrar(AuditEvento.PASSWORD_CAMBIO, usuario,
                Map.of("sesionesCerradas", sesionesCerradas), httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .body(Map.of("message", "Contraseña actualizada. Inicia sesión otra vez."));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {
        passwordResetService.solicitarReset(request.getEmail());
        // Loguea siempre con email plano (no usuario) — el endpoint es público
        // y no revela si el email existe en el cuerpo, pero el audit interno
        // sí captura el intento para análisis forense.
        auditLogService.registrar(AuditEvento.PASSWORD_RESET_SOLICITADO, null,
                Map.of("email", request.getEmail()), httpRequest);
        return ResponseEntity.ok(Map.of(
                "message",
                "Si el email existe, te hemos enviado un código de 6 dígitos."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request,
            HttpServletRequest httpRequest) {
        try {
            passwordResetService.resetearPassword(
                    request.getEmail(),
                    request.getCodigo(),
                    request.getNewPassword());
            auditLogService.registrar(AuditEvento.PASSWORD_RESET_OK, null,
                    Map.of("email", request.getEmail()), httpRequest);
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    // ====================================================================
    // 2FA TOTP — Plan v2 §2.3
    // ====================================================================

    /**
     * Paso 1 del setup de 2FA. Genera un secret nuevo, lo guarda como
     * <em>pendiente</em> (cifrado) y devuelve el QR + URI otpauth para que
     * el usuario lo escanee con su app authenticator. El 2FA NO queda
     * activo hasta que el cliente llame /2fa/enable con un código válido.
     *
     * <p>Si el usuario ya tiene 2FA activo, devuelve 409 — para regenerar
     * primero debe desactivar y volver a activar (evita perder backup
     * codes accidentalmente).
     */
    @PostMapping("/2fa/setup")
    public ResponseEntity<?> totpSetup(@AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (usuario.isTotpHabilitado()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "message", "Ya tienes 2FA activado. Desactívalo primero si quieres regenerar el secret."));
        }
        String secretPlano = totpService.generarSecret();
        usuario.setTotpSecretPendiente(totpEncryptor.cifrar(secretPlano));
        usuarioRepository.save(usuario);
        String otpauth = totpService.construirOtpauthUri(usuario, secretPlano);
        String qrDataUri = totpService.generarQrDataUri(usuario, secretPlano);
        log.info("2FA setup iniciado: username={}", usuario.getUsername());
        return ResponseEntity.ok(Map.of(
                "secret", secretPlano,
                "otpauthUri", otpauth,
                "qrCodeDataUri", qrDataUri));
    }

    /**
     * Paso 2 del setup: el usuario manda el primer código TOTP de su app.
     * Si valida contra el secret pendiente, promovemos pendiente→activo,
     * marcamos totpHabilitado=true y generamos 10 backup codes que
     * devolvemos UNA vez en plaintext.
     */
    @PostMapping("/2fa/enable")
    public ResponseEntity<?> totpEnable(@Valid @RequestBody Totp2faEnableRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (usuario.isTotpHabilitado()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "message", "El 2FA ya está activado en tu cuenta."));
        }
        String secretCifrado = usuario.getTotpSecretPendiente();
        if (secretCifrado == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "message", "No hay un setup de 2FA pendiente. Llama primero a /2fa/setup."));
        }
        String secretPlano = totpEncryptor.descifrar(secretCifrado);
        if (!totpService.validarCodigo(secretPlano, request.getCodigo())) {
            log.warn("2FA enable falló (código incorrecto): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "Código incorrecto. Comprueba la hora de tu dispositivo y vuelve a intentarlo."));
        }
        usuario.setTotpSecret(secretCifrado);
        usuario.setTotpSecretPendiente(null);
        usuario.setTotpHabilitado(true);
        usuario.setTotpHabilitadoEn(LocalDateTime.now());
        usuarioRepository.save(usuario);
        List<String> backupCodes = totpBackupCodeService.regenerar(usuario);
        log.info("2FA activado: username={}", usuario.getUsername());
        auditLogService.registrar(AuditEvento.TOTP_HABILITADO, usuario, null, httpRequest);
        return ResponseEntity.ok(Map.of(
                "message", "2FA activado correctamente. Guarda los códigos de recuperación en un lugar seguro.",
                "backupCodes", backupCodes));
    }

    /**
     * Desactiva el 2FA del usuario. Requiere password actual + código TOTP
     * para confirmar que está siendo quien dice (defensa contra hijack de
     * sesión + dispositivo perdido).
     */
    @PostMapping("/2fa/disable")
    public ResponseEntity<?> totpDisable(@Valid @RequestBody Totp2faDisableRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!usuario.isTotpHabilitado()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "message", "El 2FA no está activado."));
        }
        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            log.warn("2FA disable falló (password incorrecta): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "La contraseña no es correcta."));
        }
        String secretPlano = totpEncryptor.descifrar(usuario.getTotpSecret());
        if (!totpService.validarCodigo(secretPlano, request.getCodigo())) {
            log.warn("2FA disable falló (código incorrecto): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "El código de la app authenticator no es correcto."));
        }
        usuario.setTotpSecret(null);
        usuario.setTotpSecretPendiente(null);
        usuario.setTotpHabilitado(false);
        usuario.setTotpHabilitadoEn(null);
        usuarioRepository.save(usuario);
        int codigosBorrados = totpBackupCodeService.eliminarTodos(usuario);
        log.info("2FA desactivado: username={} backupCodesBorrados={}",
                usuario.getUsername(), codigosBorrados);
        auditLogService.registrar(AuditEvento.TOTP_DESHABILITADO, usuario, null, httpRequest);
        return ResponseEntity.ok(Map.of("message", "2FA desactivado."));
    }

    /**
     * Paso 2 del LOGIN con 2FA. Recibe el challengeToken emitido por /login
     * + el código (TOTP de 6 dígitos o backup code de 10 chars). Prueba
     * primero TOTP; si no, intenta backup code. Si OK, emite JWT + refresh
     * cookie igual que un login normal.
     *
     * <p>Cada fallo decrementa los intentos del challenge; al 3º fallo el
     * challenge se invalida y el cliente debe rehacer login desde el paso 1.
     */
    @PostMapping("/2fa/verify-login")
    public ResponseEntity<?> totpVerifyLogin(@Valid @RequestBody Totp2faVerifyLoginRequest request,
            HttpServletRequest httpRequest) {
        Optional<Long> usuarioIdOpt = twoFactorChallengeService.peek(request.getChallengeToken());
        if (usuarioIdOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "El reto de 2FA ha expirado o no existe. Inicia sesión otra vez."));
        }
        Usuario usuario = usuarioRepository.findById(usuarioIdOpt.get()).orElse(null);
        if (usuario == null || !usuario.isTotpHabilitado()) {
            twoFactorChallengeService.consumir(request.getChallengeToken());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "Estado inválido."));
        }
        String secretPlano = totpEncryptor.descifrar(usuario.getTotpSecret());
        String codigoBruto = request.getCodigo();
        boolean totpOk = totpService.validarCodigo(secretPlano, codigoBruto);
        boolean backupOk = false;
        if (!totpOk) {
            backupOk = totpBackupCodeService.consumirSiCoincide(usuario, codigoBruto);
        }
        if (!totpOk && !backupOk) {
            int restantes = twoFactorChallengeService.registrarFallo(request.getChallengeToken());
            log.warn("2FA login falló: username={} intentosRestantes={}",
                    usuario.getUsername(), restantes);
            auditLogService.registrar(AuditEvento.TOTP_LOGIN_FAIL, usuario,
                    Map.of("intentosRestantes", restantes), httpRequest);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", restantes == 0
                            ? "Demasiados intentos. Inicia sesión otra vez."
                            : "Código incorrecto.",
                    "intentosRestantes", restantes));
        }
        twoFactorChallengeService.consumir(request.getChallengeToken());
        AuditEvento eventoAudit = backupOk ? AuditEvento.TOTP_BACKUP_CODE_USADO : AuditEvento.TOTP_LOGIN_OK;
        return emitirSesionExitosa(usuario, httpRequest, eventoAudit);
    }

    /**
     * Regenera el set de 10 backup codes (invalida los anteriores). Requiere
     * código TOTP actual para confirmar identidad. Devuelve los nuevos en
     * plaintext UNA vez.
     */
    @PostMapping("/2fa/backup-codes/regenerar")
    public ResponseEntity<?> totpRegenerarBackupCodes(@Valid @RequestBody Totp2faEnableRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!usuario.isTotpHabilitado()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "message", "El 2FA no está activado."));
        }
        String secretPlano = totpEncryptor.descifrar(usuario.getTotpSecret());
        if (!totpService.validarCodigo(secretPlano, request.getCodigo())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "Código incorrecto."));
        }
        List<String> nuevos = totpBackupCodeService.regenerar(usuario);
        auditLogService.registrar(AuditEvento.TOTP_BACKUP_CODES_REGENERADOS, usuario, null, httpRequest);
        return ResponseEntity.ok(Map.of(
                "message", "Códigos de recuperación regenerados. Los anteriores ya no funcionan.",
                "backupCodes", nuevos));
    }
}
