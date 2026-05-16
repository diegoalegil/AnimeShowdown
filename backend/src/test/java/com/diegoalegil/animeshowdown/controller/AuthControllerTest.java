package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

import com.diegoalegil.animeshowdown.model.EmailVerification;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.repository.EmailVerificationRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private EmailVerificationRepository emailVerificationRepository;

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
        Map<String, String> body = Map.of(
                "username", "carla",
                "password", "secreta123");

        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.email").exists());
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
}
