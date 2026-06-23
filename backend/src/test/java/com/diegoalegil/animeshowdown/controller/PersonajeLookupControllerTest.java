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

    @Test
    void detalleAceptaAliasHistoricosYDevuelveSlugCanonico() throws Exception {
        mvc.perform(get("/api/personajes/all_might"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("allmight"))
                .andExpect(jsonPath("$.nombre").value("All Might"));

        mvc.perform(get("/api/personajes/roronoa_zoro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("zoro"));
    }

    @Test
    void detalleEmiteDtoSinFiltrarColumnasInternas() throws Exception {
        // El detalle por id/slug emite PersonajeCatalogoDto, no la entidad JPA
        // cruda: los campos user-facing siguen y las columnas internas
        // (eloSemilla, popularidadFuente, genero) no se filtran al cliente.
        mvc.perform(get("/api/personajes/luffy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("luffy"))
                .andExpect(jsonPath("$.nombre").exists())
                .andExpect(jsonPath("$.anime").exists())
                .andExpect(jsonPath("$.eloSemilla").doesNotExist())
                .andExpect(jsonPath("$.popularidadFuente").doesNotExist())
                .andExpect(jsonPath("$.genero").doesNotExist());
    }
}
