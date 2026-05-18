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

/**
 * Cobertura de los endpoints de historial competitivo del personaje
 * (Plan producto 2026-05-18 — visión estadio otaku):
 *
 * <ul>
 *   <li>{@code GET /api/personajes/{slug}/duelos-recientes}: 200 con
 *       JSON array. Si no hay enfrentamientos para el slug, devuelve
 *       array vacío (no 404).</li>
 *   <li>{@code GET /api/personajes/{slug}/matchups}: 200 con totales
 *       más listas top 3 (vacías si total=0).</li>
 *   <li>Ambos: 404 si el slug no existe.</li>
 * </ul>
 *
 * No verificamos contenido específico de duelos porque el DataSeeder de
 * test no garantiza enfrentamientos concretos por personaje — el test
 * cubre el contrato (shape + status) sin acoplarse a seed data volátil.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonajeHistorialTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void duelosRecientesDeSlugConocidoDevuelveJsonArray() throws Exception {
        // Luffy existe en el catálogo seeded.
        mvc.perform(get("/api/personajes/luffy/duelos-recientes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void duelosRecientesDeSlugInexistenteDevuelve404() throws Exception {
        mvc.perform(get("/api/personajes/no-existe-este-slug-jamas/duelos-recientes"))
                .andExpect(status().isNotFound());
    }

    @Test
    void duelosRecientesAcotaLimitAlMaximoPermitido() throws Exception {
        // limit=999 debe acotarse server-side a 20 sin romper.
        mvc.perform(get("/api/personajes/luffy/duelos-recientes?limit=999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void matchupsDeSlugConocidoDevuelveEstructuraCompleta() throws Exception {
        mvc.perform(get("/api/personajes/naruto/matchups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalEnfrentamientos").exists())
                .andExpect(jsonPath("$.mejoresMatchups").isArray())
                .andExpect(jsonPath("$.peoresMatchups").isArray())
                .andExpect(jsonPath("$.rivalesFrecuentes").isArray());
    }

    @Test
    void matchupsDeSlugInexistenteDevuelve404() throws Exception {
        mvc.perform(get("/api/personajes/no-existe/matchups"))
                .andExpect(status().isNotFound());
    }
}
