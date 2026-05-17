package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests del endpoint público de recomendaciones cross-anime
 * (Plan v2 §4.12) — GET /api/personajes/{slug}/similares.
 *
 * <p>Comprueba: contrato del payload, exclusión de mismo anime, default
 * de limit, clamp y respuesta vacía en slug inexistente.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonajeRecomendacionTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    void slugInexistenteDevuelveListaVacia() throws Exception {
        mvc.perform(get("/api/personajes/no-existe-este-personaje-jamas/similares"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void devuelveOchoPorDefecto() throws Exception {
        MvcResult res = mvc.perform(get("/api/personajes/luffy/similares"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());
        assert arr.size() == 8 : "Default limit debería ser 8, got=" + arr.size();
    }

    @Test
    void respetaLimitCustom() throws Exception {
        MvcResult res = mvc.perform(get("/api/personajes/luffy/similares?limit=4"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());
        assert arr.size() == 4 : "limit=4 debería devolver 4, got=" + arr.size();
    }

    @Test
    void clampLimitMaximo() throws Exception {
        // limit=100 debe clamparse a LIMITE_MAX=24
        MvcResult res = mvc.perform(get("/api/personajes/luffy/similares?limit=100"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());
        assert arr.size() == 24 : "limit=100 debería clampar a 24, got=" + arr.size();
    }

    @Test
    void excluyeMismoAnime() throws Exception {
        // Luffy es de One Piece. Ningún resultado debería ser One Piece.
        MvcResult res = mvc.perform(get("/api/personajes/luffy/similares?limit=20"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());
        for (JsonNode item : arr) {
            String anime = item.get("anime").asText();
            assert !"One Piece".equals(anime)
                    : "Recomendaciones cross-anime no deben incluir One Piece, got=" + anime;
        }
    }

    @Test
    void noSeIncluyeASiMismo() throws Exception {
        MvcResult res = mvc.perform(get("/api/personajes/luffy/similares?limit=20"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());
        for (JsonNode item : arr) {
            assert !"luffy".equals(item.get("slug").asText())
                    : "Resultado no debe incluir al personaje target";
        }
    }

    @Test
    void payloadContieneSlugNombreAnimeImagenScoreYVotos() throws Exception {
        mvc.perform(get("/api/personajes/luffy/similares?limit=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").exists())
                .andExpect(jsonPath("$[0].nombre").exists())
                .andExpect(jsonPath("$[0].anime").exists())
                .andExpect(jsonPath("$[0].imagenUrl").exists())
                .andExpect(jsonPath("$[0].votos").exists())
                .andExpect(jsonPath("$[0].score").exists());
    }
}
