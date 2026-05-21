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

import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonajeLookupControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private PersonajeRepository personajeRepository;

    @Test
    void detalleAceptaSlugYElIdNumericoSigueFuncionando() throws Exception {
        Long luffyId = personajeRepository.findBySlug("luffy").orElseThrow().getId();

        mvc.perform(get("/api/personajes/luffy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("luffy"));

        mvc.perform(get("/api/personajes/{id}", luffyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(luffyId));
    }
}
