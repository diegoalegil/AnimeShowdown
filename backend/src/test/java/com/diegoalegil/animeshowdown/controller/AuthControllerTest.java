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

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

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
                .andExpect(jsonPath("$.password").doesNotExist());
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
