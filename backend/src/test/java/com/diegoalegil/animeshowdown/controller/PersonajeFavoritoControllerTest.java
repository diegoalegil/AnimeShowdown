package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
 * Cobertura del flujo Mi roster / favoritos (Plan producto 2026-05-18):
 *
 * <ul>
 *   <li>GET /api/me/favoritos sin auth → 401.</li>
 *   <li>POST /favorito sin auth → 401.</li>
 *   <li>POST → GET /me/favoritos contiene el slug. Segunda POST sigue
 *       siendo 200 (idempotente, created=false).</li>
 *   <li>GET /favorito devuelve {following: true|false} según estado.</li>
 *   <li>DELETE quita el favorito; segunda DELETE sigue 200 (removed=false).</li>
 *   <li>Slug inexistente → 404 en POST/DELETE/GET.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonajeFavoritoControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String token(String username, String email) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))));
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
    void misFavoritosSinAuthDevuelve403() throws Exception {
        // Spring Security en este proyecto (stateless + JWT filter) devuelve
        // 403 cuando NO hay token, no 401. El 401 está reservado para
        // tokens inválidos/expirados.
        mvc.perform(get("/api/me/favoritos"))
                .andExpect(status().isForbidden());
    }

    @Test
    void seguirSinAuthDevuelve403() throws Exception {
        mvc.perform(post("/api/personajes/luffy/favorito"))
                .andExpect(status().isForbidden());
    }

    @Test
    void flujoCompletoSeguirChequearListarBorrar() throws Exception {
        String tk = token("roster_alice", "roster_alice@example.com");

        // POST sigue a Luffy → created=true
        mvc.perform(post("/api/personajes/luffy/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true))
                .andExpect(jsonPath("$.created").value(true));

        // POST otra vez (idempotente) → created=false, following=true
        mvc.perform(post("/api/personajes/luffy/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true))
                .andExpect(jsonPath("$.created").value(false));

        // GET /favorito → following=true
        mvc.perform(get("/api/personajes/luffy/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true));

        // GET /me/favoritos contiene Luffy
        mvc.perform(get("/api/me/favoritos")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'luffy')]").exists());

        // DELETE → removed=true
        mvc.perform(delete("/api/personajes/luffy/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(false))
                .andExpect(jsonPath("$.removed").value(true));

        // DELETE idempotente → removed=false
        mvc.perform(delete("/api/personajes/luffy/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(false))
                .andExpect(jsonPath("$.removed").value(false));

        // GET /favorito final → following=false
        mvc.perform(get("/api/personajes/luffy/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(false));
    }

    @Test
    void slugInexistenteDevuelve404() throws Exception {
        String tk = token("roster_bob", "roster_bob@example.com");

        mvc.perform(post("/api/personajes/no-existe-slug/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isNotFound());

        mvc.perform(delete("/api/personajes/no-existe-slug/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isNotFound());

        mvc.perform(get("/api/personajes/no-existe-slug/favorito")
                .header("Authorization", "Bearer " + tk))
                .andExpect(status().isNotFound());
    }

    @Test
    void favoritosSonAisladosPorUsuario() throws Exception {
        String tk1 = token("roster_user_a", "roster_user_a@example.com");
        String tk2 = token("roster_user_b", "roster_user_b@example.com");

        // user A sigue a Naruto
        mvc.perform(post("/api/personajes/naruto/favorito")
                .header("Authorization", "Bearer " + tk1))
                .andExpect(status().isOk());

        // user B no debe ver el favorito de A
        mvc.perform(get("/api/me/favoritos")
                .header("Authorization", "Bearer " + tk2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'naruto')]").doesNotExist());

        // user B chequea /favorito de Naruto → false
        mvc.perform(get("/api/personajes/naruto/favorito")
                .header("Authorization", "Bearer " + tk2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(false));
    }
}
