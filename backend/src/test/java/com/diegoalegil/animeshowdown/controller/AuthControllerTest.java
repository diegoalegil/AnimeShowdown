package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.TestAsyncConfig;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.AuditLog;
import com.diegoalegil.animeshowdown.model.EmailVerification;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.AuditLogRepository;
import com.diegoalegil.animeshowdown.repository.EmailVerificationRepository;
import com.diegoalegil.animeshowdown.repository.NotificacionRepository;
import com.diegoalegil.animeshowdown.repository.PasswordResetTokenRepository;
import com.diegoalegil.animeshowdown.repository.RefreshTokenRepository;
import com.diegoalegil.animeshowdown.repository.TotpBackupCodeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class AuthControllerTest {

    private static final String APP_ORIGIN = "http://localhost:5173";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Value("${app.totp.encryption-key}")
    private String totpKey;

    @Value("${app.totp.encryption-salt}")
    private String totpSalt;

    @MockitoSpyBean
    private EmailVerificationRepository emailVerificationRepository;

    @Autowired
    private NotificacionRepository notificacionRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private TotpBackupCodeRepository totpBackupCodeRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /** Genera el código TOTP actual para un secret dado, usando la misma lib que el backend. */
    private String generarCodigoActual(String secretPlano) throws Exception {
        long counter = Math.floorDiv(new SystemTimeProvider().getTime(), 30);
        return new DefaultCodeGenerator().generate(secretPlano, counter);
    }

    /** Registra+loguea un usuario y devuelve { token, username, password }. */
    private record Sesion(String token, String username, String password) {}

    private Sesion registrarYLoguear(String username, String password, String email) throws Exception {
        Map<String, String> reg = Map.of("username", username, "password", password, "email", email);
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());
        Map<String, String> login = Map.of("username", username, "password", password);
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();
        String token = json.readTree(loginRes.getResponse().getContentAsString()).get("token").asText();
        return new Sesion(token, username, password);
    }

    private int verifyStatus(String token) throws Exception {
        return mvc.perform(get("/api/auth/verify").param("token", token))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    private int resendStatus(String token) throws Exception {
        return mvc.perform(post("/api/auth/resend-verification")
                .header("Authorization", "Bearer " + token))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    private Optional<EmailVerification> findVerificationByTokenReal(String token) {
        return entityManager.createQuery("""
                        SELECT v
                        FROM EmailVerification v
                        WHERE v.token = :token
                        """, EmailVerification.class)
                .setParameter("token", token)
                .getResultStream()
                .findFirst();
    }

    private int invalidarActivasDelUsuarioReal(Usuario usuario, LocalDateTime ahora) {
        return entityManager.createQuery("""
                        UPDATE EmailVerification v
                        SET v.usadoEn = :ahora
                        WHERE v.usuario = :usuario AND v.usadoEn IS NULL
                        """)
                .setParameter("usuario", usuario)
                .setParameter("ahora", ahora)
                .executeUpdate();
    }

    private static String dataUri(String mime, byte[] bytes) {
        return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    private static byte[] pngBytes(int size) {
        byte[] bytes = new byte[size];
        byte[] signature = new byte[] {
                (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
        };
        System.arraycopy(signature, 0, bytes, 0, Math.min(signature.length, bytes.length));
        return bytes;
    }

    @Test
    void registroValidoDevuelve201YOcultaPassword() throws Exception {
        Map<String, String> body = Map.of(
                "username", "alice",
                "password", "secreta123",
                "email", "alice@example.com");

        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.email").value("alice@example.com"))
                .andExpect(jsonPath("$.rol").value("USER"))
                // Usuarios nuevos nacen PENDIENTE de verificar email.
                .andExpect(jsonPath("$.estadoVerificacion").value("PENDIENTE"))
                .andExpect(jsonPath("$.password").doesNotExist());

        // El service también persiste una EmailVerification activa.
        var usuario = usuarioRepository.findByUsername("alice").orElseThrow();
        var verifications = emailVerificationRepository.findAll().stream()
                .filter(v -> v.getUsuario().getId().equals(usuario.getId()))
                .toList();
        assert verifications.size() == 1 : "Debería haber 1 verification activa para alice";
        assert verifications.get(0).estaActivo() : "La verification debería estar activa";
    }

    @Test
    void verifyConTokenValidoActivaUsuario() throws Exception {
        // Registramos un usuario; el flujo crea automáticamente la EmailVerification.
        Map<String, String> body = Map.of(
                "username", "victor",
                "password", "secreta123",
                "email", "victor@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated());

        var usuario = usuarioRepository.findByUsername("victor").orElseThrow();
        var verification = emailVerificationRepository.findAll().stream()
                .filter(v -> v.getUsuario().getId().equals(usuario.getId()))
                .findFirst().orElseThrow();
        String token = verification.getToken();

        // GET /verify con el token persistido pasa el usuario a ACTIVO.
        mvc.perform(get("/api/auth/verify?token=" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificado").value(true));

        var usuarioVerificado = usuarioRepository.findById(usuario.getId()).orElseThrow();
        assert usuarioVerificado.getEstadoVerificacion() == EstadoVerificacion.ACTIVO
                : "Tras verificar, el usuario debe estar ACTIVO";

        // El token debería estar marcado como usado.
        var verificationUsada = emailVerificationRepository.findById(verification.getId()).orElseThrow();
        assert verificationUsada.getUsadoEn() != null : "El token debe estar marcado como usado";
    }

    @Test
    void verifyConcurrenteConsumeTokenUnaVezYNoDuplicaBienvenida() throws Exception {
        Map<String, String> body = Map.of(
                "username", "victor_race",
                "password", "secreta123",
                "email", "victor_race@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated());

        var usuario = usuarioRepository.findByUsername("victor_race").orElseThrow();
        var verification = emailVerificationRepository.findAll().stream()
                .filter(v -> v.getUsuario().getId().equals(usuario.getId()))
                .findFirst().orElseThrow();
        String token = verification.getToken();

        CountDownLatch lecturasDelToken = new CountDownLatch(2);
        doAnswer(invocation -> {
            String tokenLeido = invocation.getArgument(0);
            Object resultado = findVerificationByTokenReal(tokenLeido);
            lecturasDelToken.countDown();
            if (!lecturasDelToken.await(5, TimeUnit.SECONDS)) {
                throw new AssertionError("No llegaron las dos verificaciones al read del token");
            }
            return resultado;
        }).when(emailVerificationRepository).findByToken(token);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> primera = executor.submit(() -> verifyStatus(token));
            Future<Integer> segunda = executor.submit(() -> verifyStatus(token));
            List<Integer> statuses = List.of(
                    primera.get(10, TimeUnit.SECONDS),
                    segunda.get(10, TimeUnit.SECONDS));

            assertEquals(2, statuses.stream().filter(status -> status == 200).count(),
                    "Doble click del link debe ser idempotente para el usuario");
            var usuarioVerificado = usuarioRepository.findById(usuario.getId()).orElseThrow();
            assert usuarioVerificado.getEstadoVerificacion() == EstadoVerificacion.ACTIVO
                    : "El usuario debe quedar ACTIVO";

            long bienvenidas = notificacionRepository.findAll().stream()
                    .filter(n -> n.getUsuario().getId().equals(usuario.getId()))
                    .filter(n -> n.getTipo() == NotificacionTipo.BIENVENIDA)
                    .count();
            assertEquals(1, bienvenidas,
                    "El token concurrente solo debe disparar una bienvenida");
        } finally {
            executor.shutdownNow();
            reset(emailVerificationRepository);
        }
    }

    @Test
    void verifyConTokenInvalidoDevuelve400() throws Exception {
        mvc.perform(get("/api/auth/verify?token=token-inventado-que-no-existe"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.verificado").value(false));
    }

    @Test
    void resendVerificationGeneraTokenNuevo() throws Exception {
        Map<String, String> body = Map.of(
                "username", "rita",
                "password", "secreta123",
                "email", "rita@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of("username", "rita", "password", "secreta123");
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();
        String token = json.readTree(loginRes.getResponse().getContentAsString()).get("token").asText();

        var usuario = usuarioRepository.findByUsername("rita").orElseThrow();
        EmailVerification original = emailVerificationRepository.findAll().stream()
                .filter(v -> v.getUsuario().getId().equals(usuario.getId()))
                .findFirst().orElseThrow();

        mvc.perform(post("/api/auth/resend-verification")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // La original debe quedar invalidada; debe existir UNA nueva activa.
        var verificaciones = emailVerificationRepository.findAll().stream()
                .filter(v -> v.getUsuario().getId().equals(usuario.getId()))
                .toList();
        assert verificaciones.size() == 2 : "Debería haber 2 verifications: la vieja invalidada + la nueva";

        var originalActualizada = emailVerificationRepository.findById(original.getId()).orElseThrow();
        assert originalActualizada.getUsadoEn() != null : "La verification original debe quedar invalidada";

        long activas = verificaciones.stream().filter(EmailVerification::estaActivo).count();
        assert activas == 1 : "Solo debe haber 1 verification activa tras el reenvio";
    }

    @Test
    void resendVerificationConcurrenteDejaUnSoloTokenActivo() throws Exception {
        Sesion sesion = registrarYLoguear("rita_race", "secreta123", "rita_race@example.com");
        var usuario = usuarioRepository.findByUsername("rita_race").orElseThrow();

        doAnswer(invocation -> {
            Usuario usuarioArg = invocation.getArgument(0);
            LocalDateTime ahoraArg = invocation.getArgument(1);
            int resultado = invalidarActivasDelUsuarioReal(usuarioArg, ahoraArg);
            TimeUnit.MILLISECONDS.sleep(150);
            return resultado;
        }).when(emailVerificationRepository).invalidarActivasDelUsuario(any(), any());

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> primera = executor.submit(() -> resendStatus(sesion.token()));
            Future<Integer> segunda = executor.submit(() -> resendStatus(sesion.token()));
            List<Integer> statuses = List.of(
                    primera.get(10, TimeUnit.SECONDS),
                    segunda.get(10, TimeUnit.SECONDS));

            assertEquals(2, statuses.stream().filter(status -> status == 200).count(),
                    "Ambos reenvíos concurrentes deben responder OK sin duplicar estado activo");
            long activas = emailVerificationRepository.findAll().stream()
                    .filter(v -> v.getUsuario().getId().equals(usuario.getId()))
                    .filter(EmailVerification::estaActivo)
                    .count();
            assertEquals(1, activas,
                    "Dos reenvíos concurrentes deben dejar exactamente un token activo");
        } finally {
            executor.shutdownNow();
            reset(emailVerificationRepository);
        }
    }

    @Test
    void registroDuplicadoDevuelve409() throws Exception {
        Map<String, String> body = Map.of(
                "username", "bob",
                "password", "secreta123",
                "email", "bob@example.com");

        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isConflict());
    }

    @Test
    void registroSinEmailDevuelve400ConDetalle() throws Exception {
        // La validación devuelve shape estándar
        // { status, message, errors: { field: msg },... }
        // en lugar de field-map flat. El detalle del campo se accede
        // via $.errors.email en lugar de $.email.
        Map<String, String> body = Map.of(
                "username", "carla",
                "password", "secreta123");

        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.email").exists());
    }

    @Test
    void loginValidoDevuelveToken() throws Exception {
        Map<String, String> reg = Map.of(
                "username", "diana",
                "password", "secreta123",
                "email", "diana@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of(
                "username", "diana",
                "password", "secreta123");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());
    }

    @Test
    void loginPasswordIncorrectaDevuelve401() throws Exception {
        Map<String, String> reg = Map.of(
                "username", "eva",
                "password", "secreta123",
                "email", "eva@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of(
                "username", "eva",
                "password", "wrong");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginUsuarioInexistenteDevuelve401() throws Exception {
        Map<String, String> login = Map.of(
                "username", "no_existe_seguro",
                "password", "lo_que_sea");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginCuentaBloqueadaDevuelve401GenericoSinRevelarExistencia() throws Exception {
        // REGRESIÓN SEC-05: el lockout respondía 423 + minutosRestantes, lo
        // que confirmaba que la cuenta existe (enumeración) y permitía
        // mantenerla bloqueada a propósito. Debe ser 401 indistinguible del
        // de credenciales malas, incluso con la password CORRECTA.
        Map<String, String> reg = Map.of(
                "username", "lockeduser",
                "password", "secreta123",
                "email", "lockeduser@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        Map<String, String> mala = Map.of("username", "lockeduser", "password", "incorrecta");
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(mala)))
                    .andExpect(status().isUnauthorized());
        }

        Map<String, String> buena = Map.of("username", "lockeduser", "password", "secreta123");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(buena)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginEmiteCookieRefreshAcotadaYLimpiaLaLegacy() throws Exception {
        // REGRESIÓN SEC-16: la refresh cookie debe ir acotada a /api/auth y
        // cada emisión debe adjuntar el borrado de la cookie legacy con
        // Path=/ para no acumular dos cookies con el mismo nombre.
        Map<String, String> reg = Map.of(
                "username", "cookiepath",
                "password", "secreta123",
                "email", "cookiepath@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of("username", "cookiepath", "password", "secreta123");
        var setCookies = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeaders("Set-Cookie");

        boolean nuevaAcotada = setCookies.stream().anyMatch(c ->
                c.startsWith("refresh_token=") && c.contains("Path=/api/auth") && !c.contains("Max-Age=0"));
        boolean legacyBorrada = setCookies.stream().anyMatch(c ->
                c.startsWith("refresh_token=") && c.contains("Path=/;") && c.contains("Max-Age=0"));
        if (!nuevaAcotada || !legacyBorrada) {
            throw new AssertionError("Set-Cookie esperado (nueva en /api/auth + legacy borrada en /): " + setCookies);
        }
    }

    @Test
    void getMeConTokenValidoDevuelveUsuario() throws Exception {
        // REGRESIÓN: este test falla en bug donde Usuario no implementaba UserDetails
        // y auth.getName() devolvía Object.toString() en lugar del username.
        // El endpoint debe usar @AuthenticationPrincipal Usuario directamente.
        Map<String, String> reg = Map.of(
                "username", "fiona",
                "password", "secreta123",
                "email", "fiona@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of("username", "fiona", "password", "secreta123");
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();
        String token = json.readTree(loginRes.getResponse().getContentAsString()).get("token").asText();

        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("fiona"))
                .andExpect(jsonPath("$.email").value("fiona@example.com"));
    }

    @Test
    void putAvatarConTokenValidoActualiza() throws Exception {
        Map<String, String> reg = Map.of(
                "username", "gloria",
                "password", "secreta123",
                "email", "gloria@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of("username", "gloria", "password", "secreta123");
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();
        String token = json.readTree(loginRes.getResponse().getContentAsString()).get("token").asText();

        Map<String, String> body = Map.of("avatarUrl", "https://example.com/gloria.png");
        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/gloria.png"));
    }

    @Test
    void putAvatarAceptaDataUriImagenPermitida() throws Exception {
        Sesion sesion = registrarYLoguear("avatar_data_uri", "secreta123", "avatar_data_uri@example.com");
        String avatar = dataUri("image/png", pngBytes(32));

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("avatarUrl", avatar))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(avatar));
    }

    @Test
    void putAvatarRechazaMimeSpoofAunqueDeclarePng() throws Exception {
        Sesion sesion = registrarYLoguear("avatar_mime_spoof", "secreta123", "avatar_mime_spoof@example.com");
        String avatar = dataUri("image/png", "not-a-png".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("avatarUrl", avatar))))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void putAvatarRechazaBase64ConPaddingMalo() throws Exception {
        Sesion sesion = registrarYLoguear("avatar_bad_padding", "secreta123", "avatar_bad_padding@example.com");

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "avatarUrl", "data:image/png;base64,AQID="))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void putAvatarRechazaDataUriSinBytes() throws Exception {
        Sesion sesion = registrarYLoguear("avatar_zero_bytes", "secreta123", "avatar_zero_bytes@example.com");

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "avatarUrl", "data:image/png;base64,"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void putAvatarAceptaDataUriExactamenteDosMb() throws Exception {
        Sesion sesion = registrarYLoguear("avatar_exact_2mb", "secreta123", "avatar_exact_2mb@example.com");
        String avatar = dataUri("image/png", pngBytes(2 * 1024 * 1024));

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("avatarUrl", avatar))))
                .andExpect(status().isOk());
    }

    @Test
    void putAvatarRechazaDataUriConMimeNoPermitido() throws Exception {
        Sesion sesion = registrarYLoguear("avatar_svg", "secreta123", "avatar_svg@example.com");

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "avatarUrl", "data:image/svg+xml;base64,PHN2Zy8+"))))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void putAvatarRechazaDataUriDemasiadoGrande() throws Exception {
        Sesion sesion = registrarYLoguear("avatar_big", "secreta123", "avatar_big@example.com");
        String avatar = "data:image/png;base64," + "A".repeat(2_800_000);

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("avatarUrl", avatar))))
                .andExpect(status().isPayloadTooLarge());
    }

    // === Banner de perfil (V35) — mismo pipeline/validación que el avatar ===

    @Test
    void putBannerSinTokenRequiereAuth() throws Exception {
        // /api/auth/me/** está protegido: Spring Security corta al anónimo
        // (403) antes de llegar a la rama 401 del controller.
        mvc.perform(put("/api/auth/me/banner")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bannerUrl", "https://example.com/b.png"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void putBannerConTokenValidoActualiza() throws Exception {
        Sesion sesion = registrarYLoguear("banner_url", "secreta123", "banner_url@example.com");

        mvc.perform(put("/api/auth/me/banner")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "bannerUrl", "https://example.com/banner.png"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bannerUrl").value("https://example.com/banner.png"));
    }

    @Test
    void putBannerAceptaDataUriImagenPermitida() throws Exception {
        Sesion sesion = registrarYLoguear("banner_data_uri", "secreta123", "banner_data_uri@example.com");
        String banner = dataUri("image/png", pngBytes(64));

        mvc.perform(put("/api/auth/me/banner")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bannerUrl", banner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bannerUrl").value(banner));
    }

    @Test
    void putBannerVacioLoBorra() throws Exception {
        Sesion sesion = registrarYLoguear("banner_clear", "secreta123", "banner_clear@example.com");
        mvc.perform(put("/api/auth/me/banner")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "bannerUrl", "https://example.com/banner.png"))))
                .andExpect(status().isOk());

        mvc.perform(put("/api/auth/me/banner")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Collections.singletonMap("bannerUrl", ""))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bannerUrl").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void putBannerRechazaMimeSpoofAunqueDeclarePng() throws Exception {
        Sesion sesion = registrarYLoguear("banner_mime_spoof", "secreta123", "banner_mime_spoof@example.com");
        String banner = dataUri("image/png", "not-a-png".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        mvc.perform(put("/api/auth/me/banner")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bannerUrl", banner))))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void putBannerRechazaDataUriConMimeNoPermitido() throws Exception {
        Sesion sesion = registrarYLoguear("banner_svg", "secreta123", "banner_svg@example.com");

        mvc.perform(put("/api/auth/me/banner")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "bannerUrl", "data:image/svg+xml;base64,PHN2Zy8+"))))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void putBannerRechazaDataUriDemasiadoGrande() throws Exception {
        Sesion sesion = registrarYLoguear("banner_big", "secreta123", "banner_big@example.com");
        String banner = "data:image/png;base64," + "A".repeat(2_800_000);

        mvc.perform(put("/api/auth/me/banner")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bannerUrl", banner))))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void forgotPasswordLimitaTresSolicitudesEn24HorasSinRevelarEstado() throws Exception {
        String email = "reset_rate_limit@example.com";
        registrarYLoguear("reset_rate_limit", "secreta123", email);
        Map<String, String> body = Map.of("email", email);

        for (int i = 0; i < 4; i++) {
            mvc.perform(post("/api/auth/forgot-password")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").exists());
        }

        Long usuarioId = usuarioRepository.findByEmail(email).orElseThrow().getId();
        assertEquals(
                3,
                passwordResetTokenRepository.countByUsuarioIdAndCreadoEnAfter(
                        usuarioId,
                        LocalDateTime.now().minusHours(24)));
    }

    @Test
    void securityLogRegistraLoginYRegistro() throws Exception {
        // Verifica que el AuditLog captura eventos clave de auth.
        // El TestAsyncConfig hace que los @Async corran sincrónicamente, así
        // que cuando vuelve el POST la fila ya está persistida.
        long before = auditLogRepository.count();

        Map<String, String> registro = Map.of(
                "username", "security_log_user",
                "password", "secreta123",
                "email", "security-log@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(registro)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of("username", "security_log_user", "password", "secreta123");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk());

        // Login fallido también — para verificar LOGIN_FAIL.
        Map<String, String> loginMal = Map.of("username", "security_log_user", "password", "wrongpass");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(loginMal)))
                .andExpect(status().isUnauthorized());

        var logs = auditLogRepository.findAll();
        long delta = logs.size() - before;
        assert delta >= 3 : "Deberían haberse registrado al menos REGISTRO + LOGIN_OK + LOGIN_FAIL (3 security logs); delta=" + delta;

        // Cada evento debe haber dejado al menos una fila.
        long registros = logs.stream().filter(l -> l.getEvento() == AuditEvento.REGISTRO).count();
        long loginsOk = logs.stream().filter(l -> l.getEvento() == AuditEvento.LOGIN_OK).count();
        long loginsFail = logs.stream().filter(l -> l.getEvento() == AuditEvento.LOGIN_FAIL).count();
        assert registros >= 1 : "Debe haber al menos 1 REGISTRO security log";
        assert loginsOk >= 1 : "Debe haber al menos 1 LOGIN_OK security log";
        assert loginsFail >= 1 : "Debe haber al menos 1 LOGIN_FAIL security log";

        // Los detalles del LOGIN_FAIL deben tener JSON con razón.
        AuditLog ultimoFail = logs.stream()
                .filter(l -> l.getEvento() == AuditEvento.LOGIN_FAIL)
                .reduce((a, b) -> b)
                .orElseThrow();
        assert ultimoFail.getDetalles() != null && ultimoFail.getDetalles().contains("password_incorrecta")
                : "LOGIN_FAIL debe llevar detalles JSON con la razón; got=" + ultimoFail.getDetalles();
    }

    // ====================================================================
    // 2FA TOTP — 3
    // ====================================================================

    @Test
    void totpSetupYEnableActivaTotpYDevuelveBackupCodes() throws Exception {
        Sesion s = registrarYLoguear("totp_alice", "secreta123", "totp_alice@example.com");

        // Setup: el endpoint devuelve secret + otpauth + qr.
        var setupRes = mvc.perform(post("/api/auth/2fa/setup")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").isString())
                .andExpect(jsonPath("$.otpauthUri").value(org.hamcrest.Matchers.startsWith("otpauth://totp/")))
                .andExpect(jsonPath("$.qrCodeDataUri").value(org.hamcrest.Matchers.startsWith("data:image/png;base64,")))
                .andReturn();
        String secret = json.readTree(setupRes.getResponse().getContentAsString()).get("secret").asText();

        // Enable con código correcto: activa y devuelve 10 backup codes.
        Map<String, String> enableBody = Map.of("codigo", generarCodigoActual(secret));
        mvc.perform(post("/api/auth/2fa/enable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(enableBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.backupCodes").isArray())
                .andExpect(jsonPath("$.backupCodes.length()").value(10));

        var usuario = usuarioRepository.findByUsername("totp_alice").orElseThrow();
        assert usuario.isTotpHabilitado() : "Tras enable, el usuario debe tener totpHabilitado=true";
        assert usuario.getTotpSecret() != null : "El secret debe estar guardado";
        assert usuario.getTotpSecretPendiente() == null : "El pendiente debe haberse limpiado";
        assert totpBackupCodeRepository.findByUsuario(usuario).size() == 10
                : "Deben haberse persistido 10 backup codes";
    }

    @Test
    void totpEnableConCodigoIncorrectoDevuelve401YNoActiva() throws Exception {
        Sesion s = registrarYLoguear("totp_bob", "secreta123", "totp_bob@example.com");

        mvc.perform(post("/api/auth/2fa/setup")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk());

        Map<String, String> enableMal = Map.of("codigo", "000000");
        mvc.perform(post("/api/auth/2fa/enable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(enableMal)))
                .andExpect(status().isUnauthorized());

        var usuario = usuarioRepository.findByUsername("totp_bob").orElseThrow();
        assert !usuario.isTotpHabilitado() : "Tras enable fallido, no debe activarse";
        assert usuario.getTotpSecretPendiente() != null : "El pendiente debe seguir vivo para reintentar";
    }

    @Test
    void loginConTotpDevuelveChallengeYVerifyLoginCompletaSesion() throws Exception {
        Sesion s = registrarYLoguear("totp_carla", "secreta123", "totp_carla@example.com");
        // Setup + enable para activar 2FA.
        var setupRes = mvc.perform(post("/api/auth/2fa/setup")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk()).andReturn();
        String secret = json.readTree(setupRes.getResponse().getContentAsString()).get("secret").asText();
        mvc.perform(post("/api/auth/2fa/enable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("codigo", generarCodigoActual(secret)))))
                .andExpect(status().isOk());

        // Login: ahora devuelve challenge en lugar de token directo.
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "totp_carla", "password", "secreta123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requires2fa").value(true))
                .andExpect(jsonPath("$.challengeToken").isString())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andReturn();
        String challengeToken = json.readTree(loginRes.getResponse().getContentAsString())
                .get("challengeToken").asText();

        // Verify-login con código actual: completa el login.
        Map<String, String> verify = Map.of(
                "challengeToken", challengeToken,
                "codigo", generarCodigoActual(secret));
        mvc.perform(post("/api/auth/2fa/verify-login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(verify)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.usuario.totpHabilitado").value(true));
    }

    @Test
    void verifyLoginMigraSecretoLegacyCbcAGcm() throws Exception {
        // Fase 2 (re-cifrado perezoso): un usuario con el secreto en CBC legacy
        // (anterior a la migración) debe, al validar el login 2FA, quedar
        // re-cifrado a GCM — sin bloqueo y de forma transparente.
        Sesion s = registrarYLoguear("totp_legacy", "secreta123", "totp_legacy@example.com");
        var setupRes = mvc.perform(post("/api/auth/2fa/setup")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk()).andReturn();
        String secret = json.readTree(setupRes.getResponse().getContentAsString()).get("secret").asText();
        mvc.perform(post("/api/auth/2fa/enable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("codigo", generarCodigoActual(secret)))))
                .andExpect(status().isOk());

        // Forzamos el estado PRE-migración: el secreto guardado en CBC legacy
        // (misma key/salt que los beans). En prod estos venían de antes de fase 1.
        var antes = usuarioRepository.findByUsername("totp_legacy").orElseThrow();
        String cbcLegacy = Encryptors.text(totpKey, totpSalt).encrypt(secret);
        antes.setTotpSecret(cbcLegacy);
        usuarioRepository.save(antes);

        // Login + verify-login con código válido: debe completar sesión.
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "totp_legacy", "password", "secreta123"))))
                .andExpect(status().isOk()).andReturn();
        String challengeToken = json.readTree(loginRes.getResponse().getContentAsString())
                .get("challengeToken").asText();
        mvc.perform(post("/api/auth/2fa/verify-login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "challengeToken", challengeToken,
                        "codigo", generarCodigoActual(secret)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());

        // Migración perezosa: el secreto ya NO es el CBC de antes y descifra con GCM.
        var despues = usuarioRepository.findByUsername("totp_legacy").orElseThrow();
        assertThat(despues.getTotpSecret()).isNotEqualTo(cbcLegacy);
        assertThat(Encryptors.delux(totpKey, totpSalt).decrypt(despues.getTotpSecret())).isEqualTo(secret);
    }

    @Test
    void verifyLoginConMismoChallengeConcurrenteSoloEmiteUnaSesion() throws Exception {
        Sesion s = registrarYLoguear("totp_race", "secreta123", "totp_race@example.com");
        var setupRes = mvc.perform(post("/api/auth/2fa/setup")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk()).andReturn();
        String secret = json.readTree(setupRes.getResponse().getContentAsString()).get("secret").asText();
        mvc.perform(post("/api/auth/2fa/enable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("codigo", generarCodigoActual(secret)))))
                .andExpect(status().isOk());
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "totp_race", "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String challengeToken = json.readTree(loginRes.getResponse().getContentAsString())
                .get("challengeToken").asText();
        Map<String, String> verify = Map.of(
                "challengeToken", challengeToken,
                "codigo", generarCodigoActual(secret));
        int intentos = 8;
        CountDownLatch salida = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(intentos);
        try {
            List<Future<Integer>> resultados = new ArrayList<>();
            Callable<Integer> request = () -> {
                salida.await();
                return mvc.perform(post("/api/auth/2fa/verify-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(verify)))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            };
            for (int i = 0; i < intentos; i++) {
                resultados.add(pool.submit(request));
            }

            salida.countDown();

            long ok = 0;
            long rechazados = 0;
            for (Future<Integer> resultado : resultados) {
                int status = resultado.get();
                if (status == 200) ok++;
                if (status == 401) rechazados++;
            }
            assertEquals(1, ok);
            assertEquals(intentos - 1, rechazados);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void loginVerifyLoginConBackupCodeFuncionaYConsumeElCodigo() throws Exception {
        Sesion s = registrarYLoguear("totp_diana", "secreta123", "totp_diana@example.com");
        var setupRes = mvc.perform(post("/api/auth/2fa/setup")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk()).andReturn();
        String secret = json.readTree(setupRes.getResponse().getContentAsString()).get("secret").asText();
        var enableRes = mvc.perform(post("/api/auth/2fa/enable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("codigo", generarCodigoActual(secret)))))
                .andExpect(status().isOk()).andReturn();
        var backupCodes = json.readTree(enableRes.getResponse().getContentAsString()).get("backupCodes");
        String unBackupCode = backupCodes.get(0).asText();

        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "totp_diana", "password", "secreta123"))))
                .andExpect(status().isOk()).andReturn();
        String challengeToken = json.readTree(loginRes.getResponse().getContentAsString())
                .get("challengeToken").asText();

        // Verify con backup code en lugar de TOTP: también funciona.
        mvc.perform(post("/api/auth/2fa/verify-login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "challengeToken", challengeToken,
                        "codigo", unBackupCode))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());

        // El backup code usado debe haber sido marcado y ya no funcionar otra vez.
        var usuario = usuarioRepository.findByUsername("totp_diana").orElseThrow();
        long usados = totpBackupCodeRepository.findByUsuario(usuario).stream()
                .filter(c -> c.getUsadoEn() != null).count();
        assert usados == 1 : "Tras usar 1 backup code debe haber 1 marcado como usado; got=" + usados;
    }

    @Test
    void disableConPasswordYCodigoLimpiaTotpYBorraBackupCodes() throws Exception {
        Sesion s = registrarYLoguear("totp_eva", "secreta123", "totp_eva@example.com");
        var setupRes = mvc.perform(post("/api/auth/2fa/setup")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk()).andReturn();
        String secret = json.readTree(setupRes.getResponse().getContentAsString()).get("secret").asText();
        mvc.perform(post("/api/auth/2fa/enable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("codigo", generarCodigoActual(secret)))))
                .andExpect(status().isOk());

        Map<String, String> disable = Map.of(
                "password", "secreta123",
                "codigo", generarCodigoActual(secret));
        mvc.perform(post("/api/auth/2fa/disable")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(disable)))
                .andExpect(status().isOk());

        var usuario = usuarioRepository.findByUsername("totp_eva").orElseThrow();
        assert !usuario.isTotpHabilitado() : "Tras disable, totpHabilitado=false";
        assert usuario.getTotpSecret() == null : "El secret debe limpiarse";
        assert totpBackupCodeRepository.findByUsuario(usuario).isEmpty()
                : "Tras disable, no debe quedar ningún backup code";
    }

    /**
     * Regresión: grace cross-tab cubre el caso
     * dos pestañas refrescando con el mismo token viejo. La primera lo
     * rota OK, la segunda recibe 503 + Retry-After SIN Set-Cookie limpia
     * (no debe pisar la cookie nueva que la primera puso).
     */
    @Test
    void refreshGraceCrossTabDevuelve503ConRetryAfterYSinLimpiarCookie() throws Exception {
        registrarYLoguear("grace_user", "secreta123", "grace_user@example.com");
        // Las dos pestañas comparten navegador: mismo User-Agent. La grace
        // exige UA coincidente (un token reusado desde otro UA escala a
        // revoke), así que el test lo fija explícitamente como un browser real.
        String ua = "Mozilla/5.0 (grace-test)";
        // Login devuelve cookie refresh — la extraemos para reusar en dos
        // /refresh paralelos (simula misma cookie en dos pestañas).
        var loginRes = mvc.perform(post("/api/auth/login")
                .header("User-Agent", ua)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "grace_user", "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String refreshCookie = loginRes.getResponse().getCookie("refresh_token").getValue();

        // Primera rotación: 200 + nueva cookie.
        mvc.perform(post("/api/auth/refresh")
                .header("Origin", APP_ORIGIN)
                .header("User-Agent", ua)
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("refresh_token"));

        // Segunda rotación con la MISMA cookie vieja → grace cross-tab:
        // 503 + Retry-After. CRITICAL: la respuesta NO debe contener
        // Set-Cookie para refresh_token — pisaría la cookie nueva.
        var graceRes = mvc.perform(post("/api/auth/refresh")
                .header("Origin", APP_ORIGIN)
                .header("User-Agent", ua)
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().exists("Retry-After"))
                .andReturn();
        assert graceRes.getResponse().getCookie("refresh_token") == null
                : "GraceCrossTab no debe emitir Set-Cookie (pisaría la cookie nueva de la otra tab)";
    }

    @Test
    void refreshConCookieRequiereOriginPermitido() throws Exception {
        registrarYLoguear("csrf_refresh_user", "secreta123", "csrf_refresh@example.com");
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "csrf_refresh_user", "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String refreshCookie = loginRes.getResponse().getCookie("refresh_token").getValue();

        mvc.perform(post("/api/auth/refresh")
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/auth/refresh")
                .header("Origin", APP_ORIGIN)
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("refresh_token"));
    }

    @Test
    void logoutConCookieRequiereOriginPermitidoYNoRevocaSiFalla() throws Exception {
        registrarYLoguear("csrf_logout_user", "secreta123", "csrf_logout@example.com");
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "csrf_logout_user", "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String refreshCookie = loginRes.getResponse().getCookie("refresh_token").getValue();

        mvc.perform(post("/api/auth/logout")
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/auth/refresh")
                .header("Origin", APP_ORIGIN)
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isOk());
    }

    /**
     * Regresión: logout con JWT válido
     * revoca TODAS las sesiones del usuario, no solo la cookie presentada.
     * Cubre la race "tab A logout mientras tab B tenía un refresh en
     * vuelo del lado server" — tras el logout, en BD todos los refresh
     * tokens activos del usuario quedan revocados.
     *
     * Nota: usamos verificación directa en BD en vez de un POST /refresh
     * porque dentro de REUSE_GRACE_SECONDS (10s) la respuesta es 503
     * (GraceCrossTab), no 401, lo que confunde la intención del test.
     * Lo que importa es el estado: todos los tokens del usuario revocados.
     */
    @Test
    void logoutRevocaTodasLasSesionesDelUsuario() throws Exception {
        var s = registrarYLoguear("logout_user", "secreta123", "logout_user@example.com");
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk());

        // Genera una SEGUNDA cookie haciendo otro login (simula otra pestaña/dispositivo).
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "logout_user", "password", "secreta123"))))
                .andExpect(status().isOk());

        var usuario = usuarioRepository.findByUsername("logout_user").orElseThrow();
        int versionAntes = usuario.getTokenVersion();
        long activosAntes = refreshTokenRepository.findAll().stream()
                .filter(t -> t.getUsuario().getId().equals(usuario.getId()))
                .filter(t -> t.getRevocadoEn() == null)
                .count();
        assert activosAntes == 2
                : "Pre-logout: deben existir 2 sesiones activas, había " + activosAntes;

        // Logout en la PRIMERA sesión con JWT válido.
        mvc.perform(post("/api/auth/logout")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk());

        // Tras logout: cero sesiones activas (revocarTodos cerró ambas).
        long activosDespues = refreshTokenRepository.findAll().stream()
                .filter(t -> t.getUsuario().getId().equals(usuario.getId()))
                .filter(t -> t.getRevocadoEn() == null)
                .count();
        assert activosDespues == 0
                : "Post-logout: deben quedar 0 sesiones activas, hay " + activosDespues;

        var usuarioDespues = usuarioRepository.findByUsername("logout_user").orElseThrow();
        assertEquals(versionAntes + 1, usuarioDespues.getTokenVersion());
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isUnauthorized());

        var nuevoLogin = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "logout_user", "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String tokenNuevo = json.readTree(nuevoLogin.getResponse().getContentAsString()).get("token").asText();
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + tokenNuevo))
                .andExpect(status().isOk());
    }

    @Test
    void cambiarPasswordRevocaAccessTokenAnteriorYNuevoTokenPasa() throws Exception {
        var s = registrarYLoguear("password_version_user", "secreta123", "password_version_user@example.com");
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk());

        var usuario = usuarioRepository.findByUsername("password_version_user").orElseThrow();
        int versionAntes = usuario.getTokenVersion();
        mvc.perform(put("/api/auth/me/password")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "currentPassword", "secreta123",
                        "newPassword", "nueva1234"))))
                .andExpect(status().isOk());

        var usuarioDespues = usuarioRepository.findByUsername("password_version_user").orElseThrow();
        assertEquals(versionAntes + 1, usuarioDespues.getTokenVersion());
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isUnauthorized());

        var loginNuevo = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "password_version_user", "password", "nueva1234"))))
                .andExpect(status().isOk())
                .andReturn();
        String tokenNuevo = json.readTree(loginNuevo.getResponse().getContentAsString()).get("token").asText();
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + tokenNuevo))
                .andExpect(status().isOk());
    }

    // ====================================================================
    // V-8 — Onboarding OAuth: PUT /me/username, GET /me/username-available,
    //        POST /me/onboarding/skip, flag needsOnboarding
    // ====================================================================

    @Test
    void registroMarcaOnboardingCompletado() throws Exception {
        // El registro por formulario ya elige username → no necesita onboarding.
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "onbreg",
                        "password", "secreta123",
                        "email", "onbreg@example.com"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.needsOnboarding").value(false));
    }

    @Test
    void putUsernameCambiaDevuelveTokenFrescoYResuelveEnMe() throws Exception {
        Sesion s = registrarYLoguear("oldname1", "secreta123", "oldname1@example.com");

        var res = mvc.perform(put("/api/auth/me/username")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "NuevoNombre"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.usuario.username").value("NuevoNombre"))
                .andExpect(jsonPath("$.usuario.needsOnboarding").value(false))
                .andReturn();

        // La fila quedó renombrada y marcada como onboarded.
        var u = usuarioRepository.findByUsername("NuevoNombre").orElseThrow();
        assertEquals(true, u.isOnboardingCompletado());

        // El JWT fresco resuelve al usuario renombrado en /me.
        String nuevoToken = json.readTree(res.getResponse().getContentAsString())
                .get("token").asText();
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + nuevoToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("NuevoNombre"));

        // El token VIEJO lleva el username anterior como subject; tras el
        // rename ya no resuelve a ningún usuario → 403 (sin esto, el cambio
        // de username habría dejado la sesión rota hasta el siguiente refresh).
        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isForbidden());
    }

    @Test
    void putUsernameDuplicadoCaseInsensitiveDevuelve409() throws Exception {
        registrarYLoguear("sasuke_taken", "secreta123", "sasuke_taken@example.com");
        Sesion b = registrarYLoguear("user_b_dup", "secreta123", "user_b_dup@example.com");

        mvc.perform(put("/api/auth/me/username")
                .header("Authorization", "Bearer " + b.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "Sasuke_Taken"))))
                .andExpect(status().isConflict());
    }

    @Test
    void putUsernameFormatoInvalidoDevuelve400() throws Exception {
        Sesion s = registrarYLoguear("validuser1", "secreta123", "validuser1@example.com");

        // Demasiado corto (mínimo 3).
        mvc.perform(put("/api/auth/me/username")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "ab"))))
                .andExpect(status().isBadRequest());

        // Caracteres no permitidos (espacio).
        mvc.perform(put("/api/auth/me/username")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "bad name"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void putUsernameSinTokenDevuelve403() throws Exception {
        mvc.perform(put("/api/auth/me/username")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "whatever1"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getUsernameAvailableLibreDevuelveTrue() throws Exception {
        Sesion s = registrarYLoguear("checker1", "secreta123", "checker1@example.com");
        mvc.perform(get("/api/auth/me/username-available")
                .param("u", "TotallyFreeName")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void getUsernameAvailableTomadoDevuelveFalse() throws Exception {
        registrarYLoguear("occupied_name", "secreta123", "occupied_name@example.com");
        Sesion s = registrarYLoguear("checker2", "secreta123", "checker2@example.com");
        mvc.perform(get("/api/auth/me/username-available")
                .param("u", "Occupied_Name")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.reason").value("tomado"));
    }

    @Test
    void getUsernameAvailableFormatoInvalidoDevuelveFalse() throws Exception {
        Sesion s = registrarYLoguear("checker3", "secreta123", "checker3@example.com");
        mvc.perform(get("/api/auth/me/username-available")
                .param("u", "ab")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.reason").value("formato"));
    }

    @Test
    void getUsernameAvailablePropioCuentaComoDisponible() throws Exception {
        Sesion s = registrarYLoguear("checker4", "secreta123", "checker4@example.com");
        mvc.perform(get("/api/auth/me/username-available")
                .param("u", "checker4")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void postOnboardingSkipMarcaCompletado() throws Exception {
        Sesion s = registrarYLoguear("skipper1", "secreta123", "skipper1@example.com");
        // Simula una cuenta OAuth pendiente de onboarding (el registro normal
        // nace ya completado, así que lo forzamos para ejercitar el flujo).
        var u = usuarioRepository.findByUsername("skipper1").orElseThrow();
        u.setOnboardingCompletado(false);
        usuarioRepository.save(u);

        mvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsOnboarding").value(true));

        mvc.perform(post("/api/auth/me/onboarding/skip")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsOnboarding").value(false));

        var despues = usuarioRepository.findByUsername("skipper1").orElseThrow();
        assertEquals(true, despues.isOnboardingCompletado());
    }

    @Test
    void postOnboardingSkipSinTokenDevuelve403() throws Exception {
        mvc.perform(post("/api/auth/me/onboarding/skip"))
                .andExpect(status().isForbidden());
    }
}
