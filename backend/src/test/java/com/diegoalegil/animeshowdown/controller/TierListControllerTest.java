package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TierListControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private PersonajeRepository personajeRepository;

    @Test
    void creaPrivadaPorDefectoYSoloPublicaConToggle() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String token = token("tier_" + suffix);
        Personaje naruto = personajeRepository.save(personaje("tier_naruto_" + suffix, "Naruto " + suffix));
        Personaje sasuke = personajeRepository.save(personaje("tier_sasuke_" + suffix, "Sasuke " + suffix));

        MvcResult created = mvc.perform(post("/api/tier-lists")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "titulo", "Best Naruto " + suffix,
                        "items", List.of(Map.of(
                                "personajeId", naruto.getId(),
                                "tier", "S",
                                "posicion", 0))))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publico").value(false))
                .andExpect(jsonPath("$.items[0].personaje.slug").value(naruto.getSlug()))
                .andReturn();

        var body = json.readTree(created.getResponse().getContentAsString());
        long id = body.get("id").asLong();
        String slug = body.get("slug").asText();

        mvc.perform(get("/api/tier-lists/public/" + slug))
                .andExpect(status().isNotFound());

        var updatePayload = Map.of(
                "titulo", "Best Naruto " + suffix,
                "publico", true,
                "items", List.of(
                        Map.of("personajeId", naruto.getId(), "tier", "S", "posicion", 0),
                        Map.of("personajeId", sasuke.getId(), "tier", "A", "posicion", 0)));
        mvc.perform(put("/api/tier-lists/" + id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(updatePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publico").value(true))
                .andExpect(jsonPath("$.items.length()").value(2));

        mvc.perform(get("/api/tier-lists/public/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value(slug))
                .andExpect(jsonPath("$.username").value("tier_" + suffix))
                .andExpect(jsonPath("$.items[0].tier").value("S"));
    }

    private String token(String username) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", username + "@example.com"))));
        MvcResult res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    private Personaje personaje(String slug, String nombre) {
        Personaje p = new Personaje();
        p.setSlug(slug);
        p.setNombre(nombre);
        p.setAnime("Naruto");
        p.setDescripcion("Fixture");
        p.setImagenUrl("/img/Naruto/" + slug + ".webp");
        return p;
    }
}
