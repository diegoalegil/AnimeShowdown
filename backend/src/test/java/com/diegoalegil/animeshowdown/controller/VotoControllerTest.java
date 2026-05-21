package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Smoke tests de los endpoints publicos de ranking. Cubren las queries que
 * tambien alimentan /ranking, /leaderboards y recomendaciones de personajes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VotoControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private VotoRepository votoRepository;

    @Test
    void rankingsPublicosDevuelvenArraysSinExplotarConVotosReales() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Personaje a = personajeRepository.save(new Personaje(
                "ranking_a_" + suffix,
                "Ranking A " + suffix,
                "Audit Anime",
                "Fixture ranking A",
                "/img/audit/ranking-a.webp"));
        Personaje b = personajeRepository.save(new Personaje(
                "ranking_b_" + suffix,
                "Ranking B " + suffix,
                "Audit Anime",
                "Fixture ranking B",
                "/img/audit/ranking-b.webp"));
        Usuario u = usuarioRepository.save(new Usuario(
                "rankuser_" + suffix,
                "hash",
                "rankuser_" + suffix + "@example.com"));

        votoRepository.save(new Voto(a, u));
        votoRepository.save(new Voto(a, u));
        votoRepository.save(new Voto(b, u));

        mvc.perform(get("/api/votos/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'ranking_a_" + suffix + "')]").exists());

        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("periodo", "all")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'ranking_a_" + suffix + "')]").exists());

        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("anime", "Audit Anime")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'ranking_b_" + suffix + "')]").exists());

        mvc.perform(get("/api/votos/ranking/movimientos?limit=20&dias=7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        mvc.perform(get("/api/votos/top-voters?periodo=all&limit=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.username == 'rankuser_" + suffix + "')]").exists());
    }
}
