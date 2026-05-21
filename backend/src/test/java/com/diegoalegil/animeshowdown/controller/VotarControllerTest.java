package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VotarControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    void sugerirDueloDevuelveParejaEquilibradaNoCacheable() throws Exception {
        mvc.perform(get("/api/votar/sugerir-duelo"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(jsonPath("$.personaje1.slug").exists())
                .andExpect(jsonPath("$.personaje2.slug").exists())
                .andExpect(jsonPath("$.personaje1.id").isNumber())
                .andExpect(jsonPath("$.personaje2.id").isNumber())
                .andExpect(jsonPath("$.eloDiff").value(org.hamcrest.Matchers.lessThanOrEqualTo(100)))
                .andExpect(jsonPath("$.algoritmo").value("top200_elo_estimado_menos_visto_24h"));
    }

    @Test
    void sugerirDueloNoRepitePersonajesEnDiezPeticionesConCatalogoAmplio() throws Exception {
        Set<Long> ids = new HashSet<>();

        for (int i = 0; i < 10; i++) {
            String body = mvc.perform(get("/api/votar/sugerir-duelo"))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            JsonNode node = json.readTree(body);
            long a = node.get("personaje1").get("id").asLong();
            long b = node.get("personaje2").get("id").asLong();

            assertThat(a).isNotEqualTo(b);
            assertThat(node.get("eloDiff").asInt()).isLessThanOrEqualTo(100);
            assertThat(ids.add(a)).as("personaje1 no debe repetirse en la ventana reciente").isTrue();
            assertThat(ids.add(b)).as("personaje2 no debe repetirse en la ventana reciente").isTrue();
        }
    }
}
