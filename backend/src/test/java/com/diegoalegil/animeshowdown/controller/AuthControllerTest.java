package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
}
