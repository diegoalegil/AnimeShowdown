package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Integración del Wrapped y su opt-in público. El foco es el GATE de privacidad:
 * {@code GET /api/wrapped/u/{username}} NO debe exponer el Wrapped de nadie que
 * no haya hecho opt-in (404), ni filtrar qué usernames existen.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WrappedControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    private String token(String username) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", username + "@example.com"))));
        MvcResult res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void wrappedDeUsuarioPrivadoNoSeExponePublicamente() throws Exception {
        // Usuario recién creado: wrapped_publico = false por defecto.
        token("wrap_privado");
        // Sin auth, su Wrapped público debe ser 404 (no opt-in).
        mvc.perform(get("/api/wrapped/u/wrap_privado"))
                .andExpect(status().isNotFound());
    }

    @Test
    void usuarioInexistenteDevuelve404SinFiltrarExistencia() throws Exception {
        mvc.perform(get("/api/wrapped/u/no_existe_xyz"))
                .andExpect(status().isNotFound());
    }

    @Test
    void toggleRequiereAuth() throws Exception {
        mvc.perform(patch("/api/wrapped/me/publico")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"publico\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void trasOptInElWrappedEsPublicoYReversible() throws Exception {
        String tok = token("wrap_optin");

        // Opt-in: ahora es público.
        mvc.perform(patch("/api/wrapped/me/publico")
                .header("Authorization", "Bearer " + tok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"publico\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publico").value(true));

        // Sin auth, cualquiera lo ve.
        mvc.perform(get("/api/wrapped/u/wrap_optin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("wrap_optin"))
                .andExpect(jsonPath("$.publico").value(true));

        // Opt-out: vuelve a privado → 404 público.
        mvc.perform(patch("/api/wrapped/me/publico")
                .header("Authorization", "Bearer " + tok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"publico\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publico").value(false));

        mvc.perform(get("/api/wrapped/u/wrap_optin"))
                .andExpect(status().isNotFound());
    }
}
