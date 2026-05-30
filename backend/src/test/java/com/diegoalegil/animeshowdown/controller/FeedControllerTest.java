package com.diegoalegil.animeshowdown.controller;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
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
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests de integración del feed de comunidad (B7 §2).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class FeedControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;

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
        String token = tokenDe("feed_admin", "diegogildam@gmail.com");
        usuarioRepository.findByUsername("feed_admin").ifPresent(u -> {
            u.setEstadoVerificacion(com.diegoalegil.animeshowdown.model.EstadoVerificacion.ACTIVO);
            u.setRol(com.diegoalegil.animeshowdown.model.Rol.ADMIN);
            usuarioRepository.save(u);
        });
        return token;
    }

    @Test
    void feedSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(get("/api/feed"))
                .andExpect(status().isForbidden());
    }

    @Test
    void feedSinSeguidosDevuelveVacioConFlagFalse() throws Exception {
        String token = tokenDe("feed_solitario", "feed_solitario@example.com");
        mvc.perform(get("/api/feed")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.sigueAAlguien").value(false))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void feedConSeguidoMuestraSuVotoConAutoria() throws Exception {
        String adminToken = tokenAdmin();
        String creadorToken = tokenDe("feed_creador", "feed_creador@example.com");
        String lectorToken = tokenDe("feed_lector", "feed_lector@example.com");

        // El lector sigue al creador.
        long creadorId = usuarioRepository.findByUsername("feed_creador").orElseThrow().getId();
        mvc.perform(post("/api/seguidores/" + creadorId)
                .header("Authorization", "Bearer " + lectorToken))
                .andExpect(status().is2xxSuccessful());

        // Setup torneo + enfrentamiento (admin) y voto del creador.
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
                .content(json.writeValueAsString(Map.of("nombre", "Feed Torneo", "descripcion", "test"))))
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

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + creadorToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", luffy))))
                .andExpect(status().isOk());

        // El feed del lector refleja el voto del creador con su autoría. Votar
        // puede además auto-desbloquear logros (p.ej. "primer voto"), que el
        // feed también muestra del seguido — por eso afirmamos la EXISTENCIA del
        // item VOTO con autoría en vez de un length exacto.
        mvc.perform(get("/api/feed")
                .header("Authorization", "Bearer " + lectorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sigueAAlguien").value(true))
                .andExpect(jsonPath("$.items.length()", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.items[?(@.tipo=='VOTO')].payload.autorUsername",
                        hasItem("feed_creador")))
                .andExpect(jsonPath("$.items[?(@.tipo=='VOTO')].payload.personajeSlug",
                        hasItem("luffy")));
    }
}
