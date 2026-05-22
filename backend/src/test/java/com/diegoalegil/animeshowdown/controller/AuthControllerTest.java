package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.TestAsyncConfig;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.AuditLog;
import com.diegoalegil.animeshowdown.model.EmailVerification;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.repository.AuditLogRepository;
import com.diegoalegil.animeshowdown.repository.EmailVerificationRepository;
import com.diegoalegil.animeshowdown.repository.RefreshTokenRepository;
import com.diegoalegil.animeshowdown.repository.TotpBackupCodeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;

import org.springframework.context.annotation.Import;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private EmailVerificationRepository emailVerificationRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private TotpBackupCodeRepository totpBackupCodeRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

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
                // Plan v2 §2.4: usuarios nuevos nacen PENDIENTE de verificar email.
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
        // Audit fix #14 (2026-05-21): validacion ahora devuelve shape
        // estandar { status, message, errors: { field: msg }, ... }
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
        String avatar = "data:image/jpeg;base64,AQID";

        mvc.perform(put("/api/auth/me/avatar")
                .header("Authorization", "Bearer " + sesion.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("avatarUrl", avatar))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(avatar));
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

    @Test
    void auditLogRegistraLoginYRegistro() throws Exception {
        // Plan v2 §2.6: verifica que el AuditLog captura eventos clave de auth.
        // El TestAsyncConfig hace que los @Async corran sincrónicamente, así
        // que cuando vuelve el POST la fila ya está persistida.
        long before = auditLogRepository.count();

        Map<String, String> registro = Map.of(
                "username", "audit_user",
                "password", "secreta123",
                "email", "audit@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(registro)))
                .andExpect(status().isCreated());

        Map<String, String> login = Map.of("username", "audit_user", "password", "secreta123");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk());

        // Login fallido también — para verificar LOGIN_FAIL.
        Map<String, String> loginMal = Map.of("username", "audit_user", "password", "wrongpass");
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(loginMal)))
                .andExpect(status().isUnauthorized());

        var logs = auditLogRepository.findAll();
        long delta = logs.size() - before;
        assert delta >= 3 : "Deberían haberse registrado al menos REGISTRO + LOGIN_OK + LOGIN_FAIL (3 audit logs); delta=" + delta;

        // Cada evento debe haber dejado al menos una fila.
        long registros = logs.stream().filter(l -> l.getEvento() == AuditEvento.REGISTRO).count();
        long loginsOk = logs.stream().filter(l -> l.getEvento() == AuditEvento.LOGIN_OK).count();
        long loginsFail = logs.stream().filter(l -> l.getEvento() == AuditEvento.LOGIN_FAIL).count();
        assert registros >= 1 : "Debe haber al menos 1 REGISTRO audit";
        assert loginsOk >= 1 : "Debe haber al menos 1 LOGIN_OK audit";
        assert loginsFail >= 1 : "Debe haber al menos 1 LOGIN_FAIL audit";

        // Los detalles del LOGIN_FAIL deben tener JSON con razón.
        AuditLog ultimoFail = logs.stream()
                .filter(l -> l.getEvento() == AuditEvento.LOGIN_FAIL)
                .reduce((a, b) -> b)
                .orElseThrow();
        assert ultimoFail.getDetalles() != null && ultimoFail.getDetalles().contains("password_incorrecta")
                : "LOGIN_FAIL debe llevar detalles JSON con la razón; got=" + ultimoFail.getDetalles();
    }

    // ====================================================================
    // 2FA TOTP — Plan v2 §2.3
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
     * Regresión audit P1/P2 (2026-05-18): grace cross-tab cubre el caso
     * dos pestañas refrescando con el mismo token viejo. La primera lo
     * rota OK, la segunda recibe 503 + Retry-After SIN Set-Cookie limpia
     * (no debe pisar la cookie nueva que la primera puso).
     */
    @Test
    void refreshGraceCrossTabDevuelve503ConRetryAfterYSinLimpiarCookie() throws Exception {
        registrarYLoguear("grace_user", "secreta123", "grace_user@example.com");
        // Login devuelve cookie refresh — la extraemos para reusar en dos
        // /refresh paralelos (simula misma cookie en dos pestañas).
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "grace_user", "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String refreshCookie = loginRes.getResponse().getCookie("refresh_token").getValue();

        // Primera rotación: 200 + nueva cookie.
        mvc.perform(post("/api/auth/refresh")
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("refresh_token"));

        // Segunda rotación con la MISMA cookie vieja → grace cross-tab:
        // 503 + Retry-After. CRITICAL: la respuesta NO debe contener
        // Set-Cookie para refresh_token — pisaría la cookie nueva.
        var graceRes = mvc.perform(post("/api/auth/refresh")
                .cookie(new jakarta.servlet.http.Cookie("refresh_token", refreshCookie)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().exists("Retry-After"))
                .andReturn();
        assert graceRes.getResponse().getCookie("refresh_token") == null
                : "GraceCrossTab no debe emitir Set-Cookie (pisaría la cookie nueva de la otra tab)";
    }

    /**
     * Regresión audit P1 (2026-05-18, 5ª iter): logout con JWT válido
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
        // Genera una SEGUNDA cookie haciendo otro login (simula otra pestaña/dispositivo).
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", "logout_user", "password", "secreta123"))))
                .andExpect(status().isOk());

        var usuario = usuarioRepository.findByUsername("logout_user").orElseThrow();
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
    }
}
