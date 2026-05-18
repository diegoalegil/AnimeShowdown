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
 * Cobertura del endpoint de actividad reciente de votos (Plan producto
 * sprint 2026-05-18). Verifica el contrato sin depender de seed data
 * concreta de votos (el DataSeeder de test no garantiza votos por
 * personaje).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VotosPeriodoTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void slugConocidoSinVotosDevuelveCeros() throws Exception {
        mvc.perform(get("/api/personajes/luffy/votos-periodo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("luffy"))
                .andExpect(jsonPath("$.dias").value(7))
                .andExpect(jsonPath("$.votosPeriodoActual").exists())
                .andExpect(jsonPath("$.votosPeriodoAnterior").exists())
                .andExpect(jsonPath("$.delta").exists())
                .andExpect(jsonPath("$.fechaInicioActual").exists())
                .andExpect(jsonPath("$.fechaInicioAnterior").exists());
    }

    @Test
    void diasAcotaAlMaximo90() throws Exception {
        // dias=999 server-side se acota a 90
        mvc.perform(get("/api/personajes/luffy/votos-periodo?dias=999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dias").value(90));
    }

    @Test
    void diasAcotaAlMinimo1() throws Exception {
        // dias=0 → 1
        mvc.perform(get("/api/personajes/luffy/votos-periodo?dias=0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dias").value(1));
    }

    @Test
    void slugInexistenteDevuelve404() throws Exception {
        mvc.perform(get("/api/personajes/no-existe-slug-jamas/votos-periodo"))
                .andExpect(status().isNotFound());
    }

    @Test
    void batchDevuelveArrayConSlugsValidos() throws Exception {
        mvc.perform(get("/api/personajes/votos-periodo?slugs=luffy,naruto,zoro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.slug == 'luffy')]").exists())
                .andExpect(jsonPath("$[?(@.slug == 'naruto')]").exists())
                .andExpect(jsonPath("$[?(@.slug == 'zoro')]").exists());
    }

    @Test
    void batchOmiteSlugsInexistentesSinFallar() throws Exception {
        // luffy existe, garbage no — la respuesta solo trae luffy.
        mvc.perform(get("/api/personajes/votos-periodo?slugs=luffy,garbage-slug-jamas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.slug == 'luffy')]").exists())
                .andExpect(jsonPath("$[?(@.slug == 'garbage-slug-jamas')]").doesNotExist());
    }

    @Test
    void batchHonraDias() throws Exception {
        mvc.perform(get("/api/personajes/votos-periodo?slugs=luffy&dias=30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].dias").value(30));
    }

    @Test
    void batchAcotaMaximo50Slugs() throws Exception {
        // Generamos 60 slugs (la mayoría inexistentes, pero el límite se
        // aplica antes de la query). El controller corta a 50, así que
        // luffy en posición 60 NO entra. Verificamos que la respuesta NO
        // incluye luffy.
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 59; i++) {
            if (i > 0) b.append(',');
            b.append("dummy_slug_").append(i);
        }
        b.append(",luffy"); // posición 60
        mvc.perform(get("/api/personajes/votos-periodo?slugs=" + b))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'luffy')]").doesNotExist());
    }
}
