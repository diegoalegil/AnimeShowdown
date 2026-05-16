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

import java.util.Map;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.diegoalegil.animeshowdown.dto.CambioPasswordRequest;
import com.diegoalegil.animeshowdown.dto.ForgotPasswordRequest;
import com.diegoalegil.animeshowdown.dto.LoginRequest;
import com.diegoalegil.animeshowdown.dto.RegistroRequest;
import com.diegoalegil.animeshowdown.dto.ResetPasswordRequest;
import com.diegoalegil.animeshowdown.dto.TokenRespuesta;
import com.diegoalegil.animeshowdown.dto.UsuarioRespuesta;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.JwtUtil;
import com.diegoalegil.animeshowdown.service.PasswordResetService;
import com.diegoalegil.animeshowdown.service.RefreshTokenService;

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
    private final Set<String> adminEmails;
    private final boolean cookieSecure;

    public AuthController(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            PasswordResetService passwordResetService,
            RefreshTokenService refreshTokenService,
            @Value("${admin.emails:diegogildam@gmail.com}") String adminEmailsCsv,
            @Value("${app.refresh-token.cookie-secure:true}") boolean cookieSecure) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.passwordResetService = passwordResetService;
        this.refreshTokenService = refreshTokenService;
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

    private String extraerIp(HttpServletRequest req) {
        // Railway/Cloudflare ponen la IP real en X-Forwarded-For. El RemoteAddr
        // crudo sería la del proxy intermedio (no útil para auditoría).
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    @PostMapping("/registro")
    public ResponseEntity<?> registro(@Valid @RequestBody RegistroRequest request) {

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

        if (emailNormalizado != null && adminEmails.contains(emailNormalizado)) {
            nuevoUsuario.setRol(Rol.ADMIN);
            log.info("Auto-promoción a ADMIN: email={}", emailNormalizado);
        }

        Usuario guardado = usuarioRepository.save(nuevoUsuario);

        log.info("Usuario registrado: id={} username={} rol={}", guardado.getId(), guardado.getUsername(), guardado.getRol());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UsuarioRespuesta(guardado));
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
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        Usuario usuario = usuarioOpt.get();

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            log.warn("Login fallido (password incorrecta): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        String token = jwtUtil.generarToken(usuario);
        // Plan v2 §1.3: emite refresh token y lo setea como cookie httpOnly.
        // El JWT corto (15min) viaja en el body; el refresh (30d) vive en la
        // cookie y no es accesible desde JavaScript — defensa contra XSS.
        String refreshPlano = refreshTokenService.emitir(
                usuario, extraerUserAgent(httpRequest), extraerIp(httpRequest));

        log.info("Login exitoso: username={} rol={}", usuario.getUsername(), usuario.getRol());

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
                refreshCookie, extraerUserAgent(httpRequest), extraerIp(httpRequest));
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                    .body(Map.of("message", "Sesión expirada o inválida"));
        }
        RefreshTokenService.RotarResultado r = opt.get();
        String nuevoJwt = jwtUtil.generarToken(r.usuario());
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
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie) {
        if (refreshCookie != null && !refreshCookie.isBlank()) {
            refreshTokenService.revocar(refreshCookie);
        }
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
    public ResponseEntity<?> revokeAll(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        int n = refreshTokenService.revocarTodos(usuario);
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
            @AuthenticationPrincipal Usuario usuario) {
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
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .body(Map.of("message", "Contraseña actualizada. Inicia sesión otra vez."));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.solicitarReset(request.getEmail());
        return ResponseEntity.ok(Map.of(
                "message",
                "Si el email existe, te hemos enviado un código de 6 dígitos."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        try {
            passwordResetService.resetearPassword(
                    request.getEmail(),
                    request.getCodigo(),
                    request.getNewPassword());
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
