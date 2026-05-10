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
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests de integración del TorneoController contra H2 in-memory.
 * Autentica registrando usuarios reales y obteniendo JWT por /api/auth/login,
 * en lugar de @WithMockUser porque el controller usa @AuthenticationPrincipal Usuario
 * (la entidad real, no User de Spring Security) — el mock no la inyectaría correctamente.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TorneoControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    /**
     * Asegura un user con esas credenciales (idempotente entre tests). Si ya existe
     * en H2 (contexto Spring cacheado entre métodos), salta el registro y va al login.
     * Devuelve el JWT.
     */
    private String tokenUserRegistrado(String username, String email) throws Exception {
        Map<String, String> reg = Map.of(
                "username", username,
                "password", "secreta123",
                "email", email);
        // Registro: ignora 409 (ya existe de un test previo)
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)));

        Map<String, String> login = Map.of(
                "username", username,
                "password", "secreta123");
        MvcResult res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = json.readTree(res.getResponse().getContentAsString());
        return body.get("token").asText();
    }

    /** El email diegogildam@gmail.com se auto-promueve a ADMIN (admin.emails default). */
    private String tokenAdmin() throws Exception {
        return tokenUserRegistrado("admin_torneo_test", "diegogildam@gmail.com");
    }

    @Test
    void getTorneosEsPublico() throws Exception {
        mvc.perform(get("/api/torneos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void crearTorneoSinAuthDevuelveForbidden() throws Exception {
        // Spring Security sin AuthenticationEntryPoint custom devuelve 403 para
        // peticiones sin token (no 401). Lo importante es que NO entra.
        Map<String, String> body = Map.of(
                "nombre", "Torneo Anónimo",
                "descripcion", "No debería entrar");

        mvc.perform(post("/api/torneos")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void crearTorneoConRolUserDevuelve403() throws Exception {
        String tokenUser = tokenUserRegistrado("user_torneo_test", "user_torneo@example.com");

        Map<String, String> body = Map.of(
                "nombre", "Torneo Usuario",
                "descripcion", "USER no puede crear");

        mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void crearTorneoComoAdminDevuelve200ConIdYEstadoBorrador() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Admin Test",
                "descripcion", "Torneo creado en test");

        mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nombre").value("Torneo Admin Test"))
                .andExpect(jsonPath("$.estado").value("BORRADOR"));
    }

    @Test
    void iniciarTorneoBorradorPasaAEstadoActivo() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Para Iniciar",
                "descripcion", "Test");

        MvcResult res = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ACTIVO"))
                .andExpect(jsonPath("$.fechaInicio").isString());
    }

    @Test
    void iniciarTorneoYaActivoDevuelve409() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Doble Iniciar",
                "descripcion", "Test 409");

        MvcResult res = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Segundo iniciar sobre torneo ACTIVO → 409
        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    @Test
    void iniciarTorneoInexistenteDevuelve404() throws Exception {
        String token = tokenAdmin();

        mvc.perform(put("/api/torneos/9999999/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void finalizarTorneoSoloFuncionaSiEstaActivo() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Finalizar",
                "descripcion", "Test finalizar");

        MvcResult res = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        // Finalizar BORRADOR → 409
        mvc.perform(put("/api/torneos/" + id + "/finalizar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());

        // Iniciar → ACTIVO
        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Finalizar ACTIVO → 200, estado FINALIZADO
        mvc.perform(put("/api/torneos/" + id + "/finalizar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("FINALIZADO"))
                .andExpect(jsonPath("$.fechaFinalizacion").isString());
    }
}
