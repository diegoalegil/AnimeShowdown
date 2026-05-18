package com.diegoalegil.animeshowdown.controller;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.service.JikanService;

/**
 * Tests del endpoint GET /api/personajes/{slug}/imagenes (Plan v2
 * §4.12 step 1 — galería multi-imagen oficial vía Jikan).
 *
 * <p>JikanService está mockeado: los tests no pueden depender de red ni
 * de la disponibilidad real de jikan.moe. Validamos el contrato del
 * controller: 404 si slug no existe, lista vacía si Jikan no resuelve
 * mal_id o circuit-breaker fallback, clamp a 12 URLs como máximo.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonajeImagenesTest {

    @Autowired private MockMvc mvc;

    @MockitoBean private JikanService jikanService;

    @Test
    void slugInexistenteDevuelve404() throws Exception {
        mvc.perform(get("/api/personajes/no-existe-este-personaje/imagenes"))
                .andExpect(status().isNotFound());
    }

    @Test
    void cuandoJikanNoEncuentraMalIdDevuelveListaVacia() throws Exception {
        when(jikanService.searchCharacterMalId(anyString(), anyString()))
                .thenReturn(Optional.empty());

        mvc.perform(get("/api/personajes/luffy/imagenes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void devuelvePicturesCuandoJikanResuelveMalId() throws Exception {
        when(jikanService.searchCharacterMalId(anyString(), anyString()))
                .thenReturn(Optional.of(40));
        when(jikanService.fetchCharacterPictures(40)).thenReturn(List.of(
                "https://cdn.myanimelist.net/images/characters/9/310307.jpg",
                "https://cdn.myanimelist.net/images/characters/9/310308.jpg",
                "https://cdn.myanimelist.net/images/characters/9/310309.jpg"));

        mvc.perform(get("/api/personajes/luffy/imagenes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0]").value(
                        "https://cdn.myanimelist.net/images/characters/9/310307.jpg"));
    }

    @Test
    void clamp12UrlsCuandoJikanDevuelveMas() throws Exception {
        when(jikanService.searchCharacterMalId(anyString(), anyString()))
                .thenReturn(Optional.of(40));
        // Jikan devuelve 20 → controller debe recortar a 12.
        List<String> muchas = IntStream.range(0, 20)
                .mapToObj(i -> "https://cdn.myanimelist.net/images/characters/9/img" + i + ".jpg")
                .toList();
        when(jikanService.fetchCharacterPictures(anyInt())).thenReturn(muchas);

        mvc.perform(get("/api/personajes/luffy/imagenes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(12));
    }
}
