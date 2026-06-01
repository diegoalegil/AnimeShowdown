package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.TestAsyncConfig;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class FantasyShowdownControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private PersonajeRepository personajeRepository;

    private String tokenUserRegistrado(String prefix) throws Exception {
        String suffix = Long.toUnsignedString(System.nanoTime(), 36);
        String username = prefix + "_" + suffix;
        String password = "secreta123";
        Map<String, String> reg = Map.of(
                "username", username,
                "password", password,
                "email", username + "@example.com");
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        MvcResult res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = json.readTree(res.getResponse().getContentAsString());
        return body.get("token").asText();
    }

    private List<Long> cincoPersonajes() {
        List<Long> ids = personajeRepository.findAll().stream()
                .limit(5)
                .map(p -> p.getId())
                .toList();
        if (ids.size() != 5) {
            throw new IllegalStateException("El seed de test debe tener al menos cinco personajes");
        }
        return ids;
    }

    @Test
    void leaderboardEsPublicoYdevuelveArray() throws Exception {
        mvc.perform(get("/api/fantasy/leaderboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void candidatosAnonimoQuedaProtegidoPorSecurity() throws Exception {
        mvc.perform(get("/api/fantasy/candidatos"))
                .andExpect(status().isForbidden());
    }

    @Test
    void resumenAutenticadoDevuelveContratoBasico() throws Exception {
        String token = tokenUserRegistrado("fantasy_me");

        mvc.perform(get("/api/fantasy/me")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.semanaIso").isString())
                .andExpect(jsonPath("$.presupuesto").value(1000))
                .andExpect(jsonPath("$.slots").value(5))
                .andExpect(jsonPath("$.equipo").doesNotExist());
    }

    @Test
    void guardarDraftInvalidoDevuelve400ConShapeJson() throws Exception {
        String token = tokenUserRegistrado("fantasy_bad_draft");
        Map<String, List<Long>> draft = Map.of("personajeIds", List.of(1L, 2L, 3L));

        mvc.perform(put("/api/fantasy/me/equipo")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(draft)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("El draft debe tener cinco personajes únicos"))
                .andExpect(jsonPath("$.path").value("/api/fantasy/me/equipo"));
    }

    @Test
    void bloquearSinEquipoDevuelve404ConShapeJson() throws Exception {
        String token = tokenUserRegistrado("fantasy_no_team");

        mvc.perform(post("/api/fantasy/me/equipo/lock")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("No tienes equipo para esta semana"))
                .andExpect(jsonPath("$.path").value("/api/fantasy/me/equipo/lock"));
    }

    @Test
    void modificarEquipoBloqueadoDevuelve409ConShapeJson() throws Exception {
        String token = tokenUserRegistrado("fantasy_locked");
        Map<String, List<Long>> draft = Map.of("personajeIds", cincoPersonajes());

        mvc.perform(put("/api/fantasy/me/equipo")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(draft)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items.length()").value(5));

        mvc.perform(post("/api/fantasy/me/equipo/lock")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locked").value(true));

        mvc.perform(put("/api/fantasy/me/equipo")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(draft)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("El equipo de esta semana ya está bloqueado"))
                .andExpect(jsonPath("$.path").value("/api/fantasy/me/equipo"));
    }
}
