package com.diegoalegil.animeshowdown.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.diegoalegil.animeshowdown.dto.CambioPasswordRequest;
import com.diegoalegil.animeshowdown.dto.CambioUsernameRequest;
import com.diegoalegil.animeshowdown.dto.ForgotPasswordRequest;
import com.diegoalegil.animeshowdown.dto.LoginRequest;
import com.diegoalegil.animeshowdown.dto.RegistroRequest;
import com.diegoalegil.animeshowdown.dto.ResetPasswordRequest;
import com.diegoalegil.animeshowdown.dto.TokenRespuesta;
import com.diegoalegil.animeshowdown.dto.Totp2faDisableRequest;
import com.diegoalegil.animeshowdown.dto.Totp2faEnableRequest;
import com.diegoalegil.animeshowdown.dto.Totp2faVerifyLoginRequest;
import com.diegoalegil.animeshowdown.dto.UsuarioRespuesta;
import com.diegoalegil.animeshowdown.event.UsuarioRegistradoEvent;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.ClientIpExtractor;
import com.diegoalegil.animeshowdown.security.CookieCsrfOriginGuard;
import com.diegoalegil.animeshowdown.security.JwtUtil;
import com.diegoalegil.animeshowdown.security.LogSanitizer;
import com.diegoalegil.animeshowdown.security.SsrfGuard;
import com.diegoalegil.animeshowdown.service.ReferralService;
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
    // Validación genérica de imágenes de perfil (avatar y banner V35). Mismas
    // reglas para ambos: PNG/JPEG/WebP, 2 MB, magic bytes que coincidan con el
    // MIME declarado, URL http(s) o data URI embebida.
    private static final int MAX_IMAGEN_URL_LENGTH = 2_000;
    private static final long MAX_IMAGEN_DATA_BYTES = 2L * 1024L * 1024L;
    private static final Pattern IMAGEN_DATA_URI_PATTERN =
            Pattern.compile("^data:image/(png|jpe?g|webp);base64,", Pattern.CASE_INSENSITIVE);

    // V-8: mismas reglas que CambioUsernameRequest/RegistroRequest. Se reusan
    // en el chequeo en vivo GET /me/username-available, que no pasa por @Valid.
    private static final int USERNAME_MIN_LENGTH = 3;
    private static final int USERNAME_MAX_LENGTH = 30;
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[A-Za-z0-9_-]+$");

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
    private final ReferralService referralService;
    private final ClientIpExtractor clientIpExtractor;
    private final CookieCsrfOriginGuard cookieCsrfOriginGuard;
    private final ApplicationEventPublisher eventPublisher;
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
            ReferralService referralService,
            ClientIpExtractor clientIpExtractor,
            CookieCsrfOriginGuard cookieCsrfOriginGuard,
            ApplicationEventPublisher eventPublisher,
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
        this.referralService = referralService;
        this.clientIpExtractor = clientIpExtractor;
        this.cookieCsrfOriginGuard = cookieCsrfOriginGuard;
        this.eventPublisher = eventPublisher;
        this.cookieSecure = cookieSecure;
        log.info("AuthController arrancado con cookieSecure={}", cookieSecure);
    }

    // === helpers para cookies de refresh token ===

    private ResponseCookie construirCookieRefresh(String tokenPlano) {
        return ResponseCookie.from(REFRESH_COOKIE, tokenPlano)
                .httpOnly(true)
                .secure(cookieSecure)
                // Lax (no Strict): la refresh cookie tiene que viajar tras
                // redirects top-level desde dominios externos. Caso real:
                // tras un login OAuth (Google/Discord), Spring nos manda
                // SET-COOKIE refresh_token y redirige a /auth/callback. Si
                // SameSite=Strict, Safari ITP y Chrome estricto descartan
                // la cookie en el siguiente fetch a /api/auth/refresh porque
                // la cadena vino de un dominio externo (accounts.google.com).
                // El usuario aterriza autenticado en backend pero el frontend
                // no recibe token → queda como "OAuth hace algo pero no
                // crea sesión". Lax + httpOnly + Secure es la combinación
                // estándar para refresh tokens y no abre CSRF significativo.
                .sameSite("Lax")
                // Path acotado: la refresh cookie solo se necesita en
                // /api/auth/refresh y /api/auth/logout. Con Path=/ viajaba en
                // cada request a la API (más superficie de exposición).
                .path("/api/auth")
                .maxAge(refreshTokenService.getTtl())
                .build();
    }

    private ResponseCookie limpiarCookieRefresh() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                // Lax para que matchee el atributo de la cookie original
                // (los navegadores requieren mismo SameSite al borrar).
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(0)
                .build();
    }

    /**
     * Borra la refresh cookie emitida con el Path=/ antiguo. Sin esto, los
     * navegadores con sesión previa acumulan DOS cookies refresh (paths
     * distintos) y el backend puede leer la caducada. Se adjunta junto a
     * cada set/clear de la cookie nueva; retirable cuando las sesiones de
     * 30 días pre-cambio hayan expirado.
     */
    private ResponseCookie limpiarCookieRefreshLegacy() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
    }

    private String extraerUserAgent(HttpServletRequest req) {
        String ua = req.getHeader("User-Agent");
        if (ua == null) return null;
        return ua.length() > 500 ? ua.substring(0, 500) : ua;
    }

    private ResponseEntity<?> rechazarCookieCrossSite(HttpServletRequest request) {
        log.warn(
                "Petición con refresh cookie rechazada por origen no permitido: sourceOrigin={}",
                cookieCsrfOriginGuard.sourceOrigin(request));
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", "Origen no permitido para esta operación de sesión"));
    }

    @PostMapping("/registro")
    public ResponseEntity<?> registro(@Valid @RequestBody RegistroRequest request,
            HttpServletRequest httpRequest) {

        // Normaliza email a lowercase + trim para evitar duplicados por capitalización
        // (Gmail, Outlook etc. tratan emails como case-insensitive — la BBDD también debe)
        String emailNormalizado = request.email() == null ? null : request.email().trim().toLowerCase();

        // Unicidad case-insensitive: el cambio de username ya era IgnoreCase, pero
        // el registro usaba findByUsername (exacto), así que 'Naruto' y 'naruto'
        // coexistían (suplantación visual en /u/{username}).
        if (usuarioRepository.existsByUsernameIgnoreCase(request.username())) {
            log.warn("Intento de registro con username ya existente: {}", request.username());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("El username ya existe");
        }

        if (usuarioRepository.findByEmail(emailNormalizado).isPresent()) {
            log.warn("Intento de registro con email ya existente: {}", LogSanitizer.email(emailNormalizado));
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("El email ya está registrado");
        }

        String passwordHasheado = passwordEncoder.encode(request.password());

        Usuario nuevoUsuario = new Usuario(
                request.username(),
                passwordHasheado,
                emailNormalizado);
        // Registros nuevos nacen PENDIENTE hasta verificar email.
        // No pueden votar ni crear torneos en este estado.
        nuevoUsuario.setEstadoVerificacion(EstadoVerificacion.PENDIENTE);
        // Registro por formulario: el usuario ya eligió su username, así que
        // no necesita el onboarding post-login (ese flujo es para cuentas
        // OAuth con username autogenerado). V-8.
        nuevoUsuario.setOnboardingCompletado(true);
        // la auto-promoción a ADMIN NO ocurre aquí — se hace
        // en EmailVerificationService.verificar() tras pasar a ACTIVO.
        // Antes un atacante podía registrarse con el email del owner en
        // una BBDD nueva y obtener ADMIN sin tocar el inbox.

        // Si el caller envía referralCode, intenta vincular.
        // Sin código o código inválido, el registro sigue normal sin referrer.
        if (request.referralCode() != null && !request.referralCode().isBlank()) {
            referralService.resolverReferrer(request.referralCode())
                    .ifPresent(nuevoUsuario::setReferredBy);
        }
        // Auto-genera su propio código (idempotente, no falla si ya tenía).
        referralService.asignarCodigoSiHaceFalta(nuevoUsuario);

        // Guardado tolerante a la carrera ~imposible del código referral: si
        // colisiona en el UNIQUE constraint, degrada a sin-código en vez de
        // tumbar el registro (el backfill lo asigna). registro NO es @Transactional.
        Usuario guardado = referralService.guardarTolerandoColisionReferral(nuevoUsuario);
        eventPublisher.publishEvent(new UsuarioRegistradoEvent(guardado.getId()));

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
     * 4.
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
    @Transactional
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {

        // Acepta username o email en el campo username (UX: usuario teclea cualquiera)
        String identificador = request.username();
        // Para el lookup por email normalizamos a lowercase porque la BBDD lo guarda así
        // desde el fix de email-case-sensitivity. Username sigue case-sensitive (es identidad).
        String identificadorLower = identificador == null ? null : identificador.trim().toLowerCase();
        Optional<Usuario> usuarioOpt = usuarioRepository.findForUpdateByUsername(identificador)
                .or(() -> usuarioRepository.findForUpdateByEmail(identificadorLower));

        if (usuarioOpt.isEmpty()) {
            log.warn("Login fallido (usuario/email no existe): {}", LogSanitizer.identifier(identificador));
            auditLogService.registrar(AuditEvento.LOGIN_FAIL, null,
                    Map.of("identificador", LogSanitizer.identifier(identificador), "razon", "usuario_no_existe"),
                    httpRequest);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        Usuario usuario = usuarioOpt.get();

        // Account lockout. Si la cuenta está bloqueada por
        // intentos fallidos consecutivos, ni siquiera comprobamos la
        // password (defensa contra ataques que aprovechan timing).
        if (usuario.estaBloqueado()) {
            long minutos = Math.max(1,
                    java.time.Duration.between(java.time.LocalDateTime.now(), usuario.getBloqueadoHasta()).toMinutes());
            log.warn("Login fallido (cuenta bloqueada): username={} minutos_restantes={}",
                    usuario.getUsername(), minutos);
            auditLogService.registrar(AuditEvento.LOGIN_BLOQUEADO, usuario,
                    Map.of("minutosRestantes", minutos), httpRequest);
            // 401 idéntico al de credenciales malas: un 423 con minutos
            // restantes confirmaba que la cuenta existe (enumeración) y
            // permitía a un atacante mantenerla bloqueada a propósito
            // sabiendo exactamente cuándo reintentar. El detalle queda en
            // el audit log para soporte.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        if (!passwordEncoder.matches(request.password(), usuario.getPassword())) {
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

        // Si el usuario tiene 2FA activo, NO emitimos JWT ni
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
                usuario, extraerUserAgent(httpRequest), clientIpExtractor.extract(httpRequest));
        log.info("Login exitoso: username={} rol={}", usuario.getUsername(), usuario.getRol());
        auditLogService.registrar(eventoAudit, usuario, null, httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, construirCookieRefresh(refreshPlano).toString())
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefreshLegacy().toString())
                .body(new TokenRespuesta(token, new UsuarioRespuesta(usuario)));
    }

    /**
     * Rota el refresh token. El cliente envía la cookie automáticamente;
     * el backend la valida, revoca la entrada vieja, emite una nueva, y
     * devuelve un access token JWT fresco + setea la nueva cookie refresh.
     *
     * <p>Tres caminos según {@link RefreshTokenService.ResultadoRotacion}:
     * <ul>
     *   <li>{@code Ok}: 200 + nuevo JWT + nueva cookie refresh.</li>
     *   <li>{@code GraceCrossTab}: 401 SIN tocar la cookie. Antes este caso
     *     limpiaba la cookie del cliente,
     *     pisando la cookie nueva que la otra pestaña ya había puesto
     *     en el mismo dominio. Resultado: la segunda tab "ganaba"
     *     reseteando la sesión recién rotada. Ahora dejamos la cookie
     *     intacta y el cliente reintenta con el valor actualizado.</li>
     *   <li>{@code Invalido}: 401 + cookie limpia (sesión muerta).</li>
     * </ul>
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie,
            HttpServletRequest httpRequest) {
        if (refreshCookie == null || refreshCookie.isBlank()) {
            // AuthContext ahora intenta
            // refresh SIEMPRE en bootstrap (antes solo si había user en
            // localStorage). Resultado: cada visitante anónimo dispara un
            // POST /api/auth/refresh sin cookie → 401. El navegador loggea
            // "Failed to load resource: 401" como console.error, lo que
            // contamina consola y rompe los tests e2e (consoleErrors !== []).
            //
            // El 401 era semánticamente correcto pero genera ruido innecesario
            // en consola y test. Cambio a 204 No Content cuando no hay cookie:
            // el frontend ya trata !res.ok como "sin sesión" (refreshSession
            // devuelve null), y 204 no se loggea como error. Cookie inválida
            // de verdad (rotación failed, expirada) sigue dando 401 abajo.
            return ResponseEntity.noContent()
                    .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefreshLegacy().toString())
                    .build();
        }
        if (!cookieCsrfOriginGuard.isAllowed(httpRequest)) {
            return rechazarCookieCrossSite(httpRequest);
        }
        RefreshTokenService.ResultadoRotacion r = refreshTokenService.rotar(
                refreshCookie, extraerUserAgent(httpRequest), clientIpExtractor.extract(httpRequest));
        return switch (r) {
            case RefreshTokenService.ResultadoRotacion.Ok ok -> {
                String nuevoJwt = jwtUtil.generarToken(ok.usuario());
                auditLogService.registrar(AuditEvento.REFRESH_TOKEN_ROTADO, ok.usuario(), null, httpRequest);
                yield ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, construirCookieRefresh(ok.nuevoTokenPlano()).toString())
                        .body(new TokenRespuesta(nuevoJwt, new UsuarioRespuesta(ok.usuario())));
            }
            case RefreshTokenService.ResultadoRotacion.GraceCrossTab __ -> ResponseEntity
                    // 401 → 503 con Retry-After.
                    // El cliente trataba CUALQUIER no-2xx como sesión muerta y
                    // limpiaba tokenEnMemoria + notificaba STOMP, aunque la
                    // cookie nueva de la otra tab estuviera viva. 503 es
                    // semánticamente "vuelve a intentar" — el frontend reintenta
                    // tras backoff corto sin tocar la sesión local.
                    .status(HttpStatus.SERVICE_UNAVAILABLE)
                    .header(HttpHeaders.RETRY_AFTER, "1")
                    .body(Map.of("message", "Race entre pestañas, reintenta en unos segundos"));
            case RefreshTokenService.ResultadoRotacion.Invalido __ -> ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefreshLegacy().toString())
                    .body(Map.of("message", "Sesión expirada o inválida"));
        };
    }

    /**
     * Revoca el refresh token de la cookie actual y la limpia. Si llega un
     * JWT válido, también invalida los access tokens emitidos previamente
     * mediante token_version.
     *
     * <p>si el cliente envía JWT válido
     * (usuario != null), revocamos TODAS las sesiones activas del usuario
     * — no solo el token de la cookie presentada. Cubre el caso "tab A
     * pulsa logout mientras tab B tenía un refresh en vuelo": antes el
     * refresh de B podía completar tras el logout y emitir un token
     * nuevo que resucitaba la sesión. Ahora, al revocar todas las
     * familias, cualquier refresh posterior (incluso en vuelo del lado
     * server) cae en reuse-detection o sin token activo válido.
     * Si NO hay JWT (sesión ya muerta o nunca existió), solo revoca la
     * cookie presentada para preservar otras sesiones legítimas.
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (refreshCookie != null && !refreshCookie.isBlank()
                && !cookieCsrfOriginGuard.isAllowed(httpRequest)) {
            return rechazarCookieCrossSite(httpRequest);
        }
        if (usuario != null) {
            int n = refreshTokenService.revocarTodos(usuario);
            usuario.incrementarTokenVersion();
            usuarioRepository.save(usuario);
            log.info("Logout: revocadas {} sesiones del usuario={}", n, usuario.getUsername());
        } else if (refreshCookie != null && !refreshCookie.isBlank()) {
            refreshTokenService.revocar(refreshCookie);
        }
        // Audit del logout — usuario puede ser null si el JWT ya expiró pero
        // el cliente está cerrando sesión igualmente; en ese caso registramos
        // sin usuario asociado.
        auditLogService.registrar(AuditEvento.LOGOUT, usuario, null, httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefreshLegacy().toString())
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
        usuario.incrementarTokenVersion();
        usuarioRepository.save(usuario);
        auditLogService.registrar(AuditEvento.SESIONES_REVOCADAS_TODAS, usuario,
                Map.of("sesionesCerradas", n), httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefreshLegacy().toString())
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
        String avatarNormalizado = normalizarImagenUrl(body.get("avatarUrl"));
        ResponseEntity<?> invalido = validarImagen(avatarNormalizado);
        if (invalido != null) {
            return invalido;
        }
        // Recargar la entidad gestionada antes de mutar: guardar el principal del JWT
        // (desligado/obsoleto) haría merge de TODAS sus columnas y revertiría cambios
        // concurrentes como eloPvp/pvpPartidos. Patrón de MarcoService.equipar.
        Usuario gestionado = usuarioRepository.findById(usuario.getId()).orElse(usuario);
        gestionado.setAvatarUrl(avatarNormalizado);
        usuarioRepository.save(gestionado);
        log.info("Avatar actualizado: username={}", gestionado.getUsername());
        return ResponseEntity.ok(new UsuarioRespuesta(gestionado));
    }

    /**
     * Banner/cabecera del perfil (V35). Mismo contrato y validación que el
     * avatar (imagen subida en base64 o URL pública, PNG/JPEG/WebP, ≤2 MB) —
     * reutiliza los validadores genéricos de imagen. {@code bannerUrl} null o
     * en blanco lo borra (NULL): el frontend/OG vuelven al arte del personaje
     * favorito.
     */
    @PutMapping("/me/banner")
    public ResponseEntity<?> actualizarBanner(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String bannerNormalizado = normalizarImagenUrl(body.get("bannerUrl"));
        ResponseEntity<?> invalido = validarImagen(bannerNormalizado);
        if (invalido != null) {
            return invalido;
        }
        // Recargar la entidad gestionada antes de mutar (ver actualizarAvatar): evita
        // que el merge del principal desligado revierta columnas concurrentes.
        Usuario gestionado = usuarioRepository.findById(usuario.getId()).orElse(usuario);
        gestionado.setBannerUrl(bannerNormalizado);
        usuarioRepository.save(gestionado);
        log.info("Banner actualizado: username={}", gestionado.getUsername());
        return ResponseEntity.ok(new UsuarioRespuesta(gestionado));
    }

    private static String normalizarImagenUrl(String imagenUrl) {
        if (imagenUrl == null || imagenUrl.isBlank()) {
            return null;
        }
        return imagenUrl.trim();
    }

    private static ResponseEntity<?> validarImagen(String imagenUrl) {
        if (imagenUrl == null) {
            return null;
        }
        if (imagenUrl.regionMatches(true, 0, "data:", 0, "data:".length())) {
            return validarImagenDataUri(imagenUrl);
        }
        if (imagenUrl.length() > MAX_IMAGEN_URL_LENGTH) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("La URL de la imagen es demasiado larga (máx 2000 caracteres)");
        }
        if (!imagenUrl.startsWith("http://") && !imagenUrl.startsWith("https://")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("La imagen debe ser una URL http(s) o una imagen embebida permitida");
        }
        // SSRF (defensa en input): rechaza ya al guardar las IPs internas
        // literales. El guard real, con resolución DNS, vive en
        // OgImageService.leerImagen, que es quien hace el fetch server-side.
        try {
            if (SsrfGuard.isBlockedLiteralHost(URI.create(imagenUrl).getHost())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("La URL de la imagen apunta a una dirección interna no permitida");
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("La URL de la imagen no es válida");
        }
        return null;
    }

    private static ResponseEntity<?> validarImagenDataUri(String imagenUrl) {
        Matcher matcher = IMAGEN_DATA_URI_PATTERN.matcher(imagenUrl);
        if (!matcher.find()) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body("Formato de imagen no permitido. Usa PNG, JPEG o WebP.");
        }
        int commaIndex = imagenUrl.indexOf(',');
        if (commaIndex < 0 || commaIndex == imagenUrl.length() - 1) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Data URI de imagen inválida");
        }
        String base64 = imagenUrl.substring(commaIndex + 1).replaceAll("\\s", "");
        if (decodedBase64Bytes(base64) > MAX_IMAGEN_DATA_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body("Imagen demasiado grande (máx 2 MB)");
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Base64 de imagen inválido");
        }
        if (decoded.length == 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Data URI de imagen vacía");
        }
        String mime = matcher.group(1).toLowerCase(Locale.ROOT);
        if (!imagenBytesCoincidenConMime(mime, decoded)) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body("El contenido de la imagen no coincide con el tipo declarado");
        }
        return null;
    }

    private static boolean imagenBytesCoincidenConMime(String mime, byte[] bytes) {
        return switch (mime) {
            case "png" -> bytes.length >= 8
                    && (bytes[0] & 0xFF) == 0x89
                    && bytes[1] == 'P'
                    && bytes[2] == 'N'
                    && bytes[3] == 'G'
                    && bytes[4] == 0x0D
                    && bytes[5] == 0x0A
                    && bytes[6] == 0x1A
                    && bytes[7] == 0x0A;
            case "jpg", "jpeg" -> bytes.length >= 3
                    && (bytes[0] & 0xFF) == 0xFF
                    && (bytes[1] & 0xFF) == 0xD8
                    && (bytes[2] & 0xFF) == 0xFF;
            case "webp" -> bytes.length >= 12
                    && bytes[0] == 'R'
                    && bytes[1] == 'I'
                    && bytes[2] == 'F'
                    && bytes[3] == 'F'
                    && bytes[8] == 'W'
                    && bytes[9] == 'E'
                    && bytes[10] == 'B'
                    && bytes[11] == 'P';
            default -> false;
        };
    }

    private static long decodedBase64Bytes(String base64) {
        int padding = 0;
        if (base64.endsWith("==")) {
            padding = 2;
        } else if (base64.endsWith("=")) {
            padding = 1;
        }
        return (base64.length() * 3L / 4L) - padding;
    }

    // ====================================================================
    // V-8 — Onboarding OAuth: username editable + flag needsOnboarding
    // ====================================================================

    /**
     * Cambia el username del usuario autenticado (desde el onboarding o
     * desde Ajustes). Valida formato vía {@link CambioUsernameRequest} y
     * unicidad case-insensitive (409 si está tomado por otra cuenta).
     *
     * <p>Marca el onboarding como completado: confirmar el username (aunque
     * sea el autogenerado) cierra el paso post-login.
     *
     * <p>El JWT lleva el username como {@code subject} y JwtAuthFilter
     * resuelve el principal con {@code findByUsername}. Si solo cambiáramos
     * la fila, el access token en memoria del cliente (válido hasta 15 min)
     * apuntaría a un username que ya no existe → 401 hasta el siguiente
     * refresh. Por eso devolvemos un JWT fresco con el username nuevo para
     * que la sesión siga viva sin cortes (el refresh token de la cookie no
     * embebe el username, así que no hace falta rotarlo).
     */
    @PutMapping("/me/username")
    public ResponseEntity<?> cambiarUsername(
            @Valid @RequestBody CambioUsernameRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String nuevo = request.username().trim();
        // Solo chequeamos colisión si realmente cambia (un confirm idempotente
        // del mismo username no debe dar 409 contra uno mismo). El cambio de
        // solo-mayúsculas ("naruto" -> "Naruto") sí pasa por aquí pero el count
        // excluye la propia fila, así que es válido.
        if (!nuevo.equals(usuario.getUsername())
                && usuarioRepository.countByUsernameIgnoreCaseExcludingId(nuevo, usuario.getId()) > 0) {
            log.warn("Cambio de username rechazado (ya en uso): solicitado={}", nuevo);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Ese username ya está en uso. Prueba con otro."));
        }
        String anterior = usuario.getUsername();
        usuario.setUsername(nuevo);
        usuario.setOnboardingCompletado(true);
        usuarioRepository.save(usuario);
        log.info("Username cambiado: {} -> {}", anterior, nuevo);
        auditLogService.registrar(AuditEvento.USERNAME_CAMBIADO, usuario,
                Map.of("anterior", anterior, "nuevo", nuevo), httpRequest);
        String token = jwtUtil.generarToken(usuario);
        return ResponseEntity.ok(new TokenRespuesta(token, new UsuarioRespuesta(usuario)));
    }

    /**
     * Chequeo en vivo de disponibilidad de username para el onboarding/Ajustes
     * (debounced en el frontend). Devuelve {@code {available, reason}} sin
     * lanzar excepciones de validación: {@code reason} es "formato" si el
     * candidato no cumple las reglas, "tomado" si ya existe (case-insensitive)
     * en otra cuenta, o ausente si está libre. El username propio cuenta como
     * disponible (es tuyo). No está rate-limited (solo GET).
     */
    @GetMapping("/me/username-available")
    public ResponseEntity<?> usernameDisponible(
            @RequestParam("u") String u,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String candidato = u == null ? "" : u.trim();
        if (candidato.length() < USERNAME_MIN_LENGTH
                || candidato.length() > USERNAME_MAX_LENGTH
                || !USERNAME_PATTERN.matcher(candidato).matches()) {
            return ResponseEntity.ok(Map.of("available", false, "reason", "formato"));
        }
        boolean tomado = !candidato.equalsIgnoreCase(usuario.getUsername())
                && usuarioRepository.countByUsernameIgnoreCaseExcludingId(candidato, usuario.getId()) > 0;
        if (tomado) {
            return ResponseEntity.ok(Map.of("available", false, "reason", "tomado"));
        }
        return ResponseEntity.ok(Map.of("available", true));
    }

    /**
     * Marca el onboarding como completado sin cambiar nada más ("Saltar por
     * ahora", o cerrar el modal tras tocar solo el avatar). Idempotente.
     */
    @PostMapping("/me/onboarding/skip")
    public ResponseEntity<?> saltarOnboarding(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!usuario.isOnboardingCompletado()) {
            usuario.setOnboardingCompletado(true);
            usuarioRepository.save(usuario);
            log.info("Onboarding saltado/completado: username={}", usuario.getUsername());
        }
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
        if (!passwordEncoder.matches(request.currentPassword(), usuario.getPassword())) {
            log.warn("Cambio password fallido (current incorrecta): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "La contraseña actual no coincide"));
        }
        if (request.newPassword().equals(request.currentPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "La nueva contraseña debe ser distinta a la actual"));
        }
        usuario.setPassword(passwordEncoder.encode(request.newPassword()));
        usuario.incrementarTokenVersion();
        usuarioRepository.save(usuario);
        // Invalidar todas las sesiones previas tras cambio de
        // password. Si alguien tenía robada la sesión, el cambio de pass la
        // cierra, incluido cualquier access token emitido antes del cambio.
        int sesionesCerradas = refreshTokenService.revocarTodos(usuario);
        log.info("Password cambiada: username={} (cerradas {} sesiones)",
                usuario.getUsername(), sesionesCerradas);
        auditLogService.registrar(AuditEvento.PASSWORD_CAMBIO, usuario,
                Map.of("sesionesCerradas", sesionesCerradas), httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefresh().toString())
                .header(HttpHeaders.SET_COOKIE, limpiarCookieRefreshLegacy().toString())
                .body(Map.of("message", "Contraseña actualizada. Inicia sesión otra vez."));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {
        passwordResetService.solicitarReset(request.email());
        // Loguea siempre con email plano (no usuario): el endpoint es público
        // y no revela si el email existe en el cuerpo, pero el registro de
        // seguridad sí captura el intento para análisis forense.
        auditLogService.registrar(AuditEvento.PASSWORD_RESET_SOLICITADO, null,
                Map.of("email", LogSanitizer.email(request.email())), httpRequest);
        return ResponseEntity.ok(Map.of(
                "message",
                "Si el email existe, te hemos enviado un código de 6 dígitos."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request,
            HttpServletRequest httpRequest) {
        try {
            passwordResetService.resetearPassword(
                    request.email(),
                    request.codigo(),
                    request.newPassword());
            auditLogService.registrar(AuditEvento.PASSWORD_RESET_OK, null,
                    Map.of("email", LogSanitizer.email(request.email())), httpRequest);
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    // ====================================================================
    // 2FA TOTP — 3
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
    @Transactional
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
        if (!totpService.validarCodigo(secretPlano, request.codigo())) {
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
    @Transactional
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
        if (!passwordEncoder.matches(request.password(), usuario.getPassword())) {
            log.warn("2FA disable falló (password incorrecta): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "La contraseña no es correcta."));
        }
        String secretPlano = totpEncryptor.descifrar(usuario.getTotpSecret());
        if (!totpService.validarCodigo(secretPlano, request.codigo())) {
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
     * Descifra el secreto TOTP almacenado y, si estaba en CBC legacy (fallback
     * de lectura), lo re-cifra a GCM y lo persiste — migración PEREZOSA (fase 2):
     * en cuanto un usuario con secreto antiguo valida (login/regenerar), su
     * secreto sube a GCM autenticado, una sola vez. El valor del secreto NO
     * cambia (mismo plaintext); solo su cifrado en reposo. Corre dentro de la tx
     * @Transactional del flujo. Tras migrar a casi todos, se retira el fallback
     * CBC (fase 3).
     */
    private String descifrarTotpMigrando(Usuario usuario) {
        TotpEncryptor.Descifrado d = totpEncryptor.descifrarConOrigen(usuario.getTotpSecret());
        if (d.legado() && d.plaintext() != null) {
            usuario.setTotpSecret(totpEncryptor.cifrar(d.plaintext()));
            usuarioRepository.save(usuario);
            log.info("2FA: secreto TOTP migrado CBC->GCM (perezoso) username={}", usuario.getUsername());
        }
        return d.plaintext();
    }

    /**
     * Valida un código TOTP con anti-replay: el step de 30s aceptado se
     * persiste en el usuario y cualquier código de un step ya consumido se
     * rechaza. Sin esto, un código interceptado vale ~90s (drift de la lib).
     *
     * <p>Se aplica SOLO a /2fa/verify-login (superficie sin sesión, objetivo
     * real de replay/fuerza bruta). enable/disable/regenerar usan
     * {@code validarCodigo} a secas: exigen sesión autenticada (+password en
     * disable) y el anti-replay ahí rompía flujos legítimos dentro del mismo
     * step de 30s (setup→enable→disable seguidos).
     */
    private boolean validarTotpAntiReplay(Usuario usuario, String secretPlano, String codigo) {
        long step = totpService.validarCodigoStep(secretPlano, codigo);
        if (step < 0) return false;
        Long ultimo = usuario.getTotpUltimoStep();
        if (ultimo != null && step <= ultimo) {
            log.warn("TOTP replay rechazado: username={} step={}", usuario.getUsername(), step);
            return false;
        }
        usuario.setTotpUltimoStep(step);
        usuarioRepository.save(usuario);
        return true;
    }

    /**
     * Paso 2 del LOGIN con 2FA. Recibe el challengeToken emitido por /login
     * + el código (TOTP de 6 dígitos o backup code de 10 chars). Prueba
     * primero TOTP; si no, intenta backup code. Si OK, emite JWT + refresh
     * cookie igual que un login normal.
     *
     * <p>Cada fallo decrementa los intentos del challenge; al 3º fallo el
     * challenge se invalida y el cliente debe rehacer login desde el paso 1.
     * Además hay un tope de fallos POR CUENTA (ventana 15 min) para que
     * re-emitir challenges no permita fuerza bruta del TOTP.
     */
    @Transactional
    @PostMapping("/2fa/verify-login")
    public ResponseEntity<?> totpVerifyLogin(@Valid @RequestBody Totp2faVerifyLoginRequest request,
            HttpServletRequest httpRequest) {
        Optional<Long> usuarioIdOpt = twoFactorChallengeService.peek(request.challengeToken());
        if (usuarioIdOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "El reto de 2FA ha expirado o no existe. Inicia sesión otra vez."));
        }
        Usuario usuario = usuarioRepository.findById(usuarioIdOpt.get()).orElse(null);
        if (usuario == null || !usuario.isTotpHabilitado()) {
            twoFactorChallengeService.consumir(request.challengeToken());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "Estado inválido."));
        }
        if (twoFactorChallengeService.usuarioBloqueado(usuario.getId())) {
            auditLogService.registrar(AuditEvento.TOTP_LOGIN_FAIL, usuario,
                    Map.of("razon", "cuenta_bloqueada_2fa"), httpRequest);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "Demasiados intentos. Espera unos minutos y vuelve a iniciar sesión."));
        }
        String secretPlano = descifrarTotpMigrando(usuario);
        String codigoBruto = request.codigo();
        boolean totpOk = validarTotpAntiReplay(usuario, secretPlano, codigoBruto);
        Optional<Long> backupCodeId = Optional.empty();
        if (!totpOk) {
            backupCodeId = totpBackupCodeService.buscarCodigoCoincidenteNoUsado(usuario, codigoBruto);
        }
        if (!totpOk && backupCodeId.isEmpty()) {
            twoFactorChallengeService.registrarFalloUsuario(usuario.getId());
            int restantes = twoFactorChallengeService.registrarFallo(request.challengeToken());
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
        Optional<Long> consumido = twoFactorChallengeService.consumir(request.challengeToken());
        if (consumido.isEmpty() || !consumido.get().equals(usuario.getId())) {
            log.warn("2FA login rechazado por challenge ya consumido: username={}", usuario.getUsername());
            auditLogService.registrar(AuditEvento.TOTP_LOGIN_FAIL, usuario,
                    Map.of("razon", "challenge_consumido"), httpRequest);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "message", "El reto de 2FA ha expirado o no existe. Inicia sesión otra vez."));
        }
        boolean backupOk = false;
        if (!totpOk) {
            backupOk = totpBackupCodeService.marcarUsadoSiDisponible(usuario, backupCodeId.orElseThrow());
            if (!backupOk) {
                log.warn("2FA login falló por backup code ya consumido: username={}", usuario.getUsername());
                auditLogService.registrar(AuditEvento.TOTP_LOGIN_FAIL, usuario,
                        Map.of("razon", "backup_code_consumido"), httpRequest);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                        "message", "Código incorrecto."));
            }
        }
        twoFactorChallengeService.limpiarFallosUsuario(usuario.getId());
        AuditEvento eventoAudit = backupOk ? AuditEvento.TOTP_BACKUP_CODE_USADO : AuditEvento.TOTP_LOGIN_OK;
        return emitirSesionExitosa(usuario, httpRequest, eventoAudit);
    }

    /**
     * Regenera el set de 10 backup codes (invalida los anteriores). Requiere
     * código TOTP actual para confirmar identidad. Devuelve los nuevos en
     * plaintext UNA vez.
     */
    @Transactional
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
        String secretPlano = descifrarTotpMigrando(usuario);
        if (!totpService.validarCodigo(secretPlano, request.codigo())) {
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
