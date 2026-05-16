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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración del perfil del usuario (Plan v2 §4.1).
 *
 * <p>Cubre los 3 endpoints {@code /api/perfil/me/*} con auth, sin auth y
 * con datos básicos generados in-test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class PerfilControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    private String tokenDe(String username, String email) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))));
        var res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    private String tokenAdmin() throws Exception {
        return tokenDe("admin_torneo_test", "diegogildam@gmail.com");
    }

    @Test
    void statsSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(get("/api/perfil/me/stats"))
                .andExpect(status().isForbidden());
    }

    @Test
    void statsUsuarioNuevoDevuelveCeros() throws Exception {
        String token = tokenDe("perfil_alice", "perfil_alice@example.com");
        mvc.perform(get("/api/perfil/me/stats")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.votosTotales").value(0))
                .andExpect(jsonPath("$.prediccionesAcertadas").value(0))
                .andExpect(jsonPath("$.porcentajeAciertos").value(0.0))
                .andExpect(jsonPath("$.badgesDesbloqueados").value(0));
    }

    @Test
    void historialUsuarioNuevoDevuelveEmpty() throws Exception {
        String token = tokenDe("perfil_bob", "perfil_bob@example.com");
        mvc.perform(get("/api/perfil/me/historial-votos")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void topUsuarioNuevoDevuelveListaVacia() throws Exception {
        String token = tokenDe("perfil_carla", "perfil_carla@example.com");
        mvc.perform(get("/api/perfil/me/top?limit=5")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void perfilPublicoSinAuthDevuelveStatsYFlags() throws Exception {
        // Registra el usuario para que exista, sin tokens necesarios para la lectura.
        tokenDe("perfil_publico_anon", "perfil_publico_anon@example.com");

        mvc.perform(get("/api/perfil/perfil_publico_anon"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("perfil_publico_anon"))
                .andExpect(jsonPath("$.esMismoUsuario").value(false))
                .andExpect(jsonPath("$.siguiendo").doesNotExist())
                .andExpect(jsonPath("$.seguidores").value(0))
                .andExpect(jsonPath("$.seguidos").value(0))
                .andExpect(jsonPath("$.stats.votosTotales").value(0))
                .andExpect(jsonPath("$.top").isArray())
                .andExpect(jsonPath("$.logros").isArray());
    }

    @Test
    void perfilPublicoUsernameInexistenteDevuelve404() throws Exception {
        mvc.perform(get("/api/perfil/no_existe_jamas_42"))
                .andExpect(status().isNotFound());
    }

    @Test
    void perfilPublicoConCallerDistintoTraeSiguiendoFalse() throws Exception {
        tokenDe("perfil_target_x", "perfil_target_x@example.com");
        String callerToken = tokenDe("perfil_caller_y", "perfil_caller_y@example.com");

        mvc.perform(get("/api/perfil/perfil_target_x")
                .header("Authorization", "Bearer " + callerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.esMismoUsuario").value(false))
                .andExpect(jsonPath("$.siguiendo").value(false));
    }

    @Test
    void perfilPublicoConCallerIgualMarcaEsMismoUsuario() throws Exception {
        String token = tokenDe("perfil_self_z", "perfil_self_z@example.com");

        mvc.perform(get("/api/perfil/perfil_self_z")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.esMismoUsuario").value(true))
                .andExpect(jsonPath("$.siguiendo").doesNotExist());
    }

    @Test
    void historialTrasUnVotoReflejaElEnfrentamiento() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenDe("perfil_diana", "perfil_diana@example.com");

        // Setup: torneo + enfrentamiento
        MvcResult resPers = mvc.perform(get("/api/personajes")).andReturn();
        JsonNode personajes = json.readTree(resPers.getResponse().getContentAsString());
        long luffy = -1, zoro = -1;
        for (JsonNode p : personajes) {
            if ("luffy".equals(p.get("slug").asText())) luffy = p.get("id").asLong();
            if ("zoro".equals(p.get("slug").asText())) zoro = p.get("id").asLong();
        }
        MvcResult resT = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("nombre", "Perfil Hist", "descripcion", "test"))))
                .andReturn();
        long torneoId = json.readTree(resT.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/torneos/" + torneoId + "/iniciar")
                .header("Authorization", "Bearer " + adminToken)).andExpect(status().isOk());
        MvcResult resE = mvc.perform(post("/api/torneos/" + torneoId + "/enfrentamientos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        List.of(Map.of("personaje1Id", luffy, "personaje2Id", zoro)))))
                .andReturn();
        long enfId = json.readTree(resE.getResponse().getContentAsString()).get(0).get("id").asLong();

        // Diana vota a Luffy
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", luffy))))
                .andExpect(status().isOk());

        // El historial muestra el voto con el oponente y el torneo poblados.
        mvc.perform(get("/api/perfil/me/historial-votos")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].personajeSlug").value("luffy"))
                .andExpect(jsonPath("$.content[0].oponenteSlug").value("zoro"))
                .andExpect(jsonPath("$.content[0].torneoId").value(torneoId));

        // Stats refleja votosTotales=1
        mvc.perform(get("/api/perfil/me/stats")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.votosTotales").value(1));

        // Top refleja luffy con 1 voto
        mvc.perform(get("/api/perfil/me/top")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].slug").value("luffy"))
                .andExpect(jsonPath("$[0].votos").value(1));
    }
}
