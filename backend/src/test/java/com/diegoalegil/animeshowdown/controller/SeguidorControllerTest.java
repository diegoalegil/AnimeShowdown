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
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.TestAsyncConfig;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración del sistema friends / follow (Plan v2 §4.5).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class SeguidorControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;

    private record Sesion(String token, Long id, String username) {}

    private Sesion crear(String username, String email) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))));
        var u = usuarioRepository.findByUsername(username).orElseThrow();
        var res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String token = json.readTree(res.getResponse().getContentAsString()).get("token").asText();
        return new Sesion(token, u.getId(), username);
    }

    @Test
    void seguirSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(post("/api/seguidores/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    void seguirAUnoMismoDevuelve400() throws Exception {
        Sesion a = crear("follow_self", "follow_self@example.com");
        mvc.perform(post("/api/seguidores/" + a.id())
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void seguirAOtroDevuelve200YPersisteRelacion() throws Exception {
        Sesion a = crear("follow_alice", "follow_alice@example.com");
        Sesion b = crear("follow_bob", "follow_bob@example.com");

        mvc.perform(post("/api/seguidores/" + b.id())
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seguido").value(true))
                .andExpect(jsonPath("$.nuevo").value(true));

        // Stats reflejan: bob tiene 1 seguidor, alice sigue a 1.
        mvc.perform(get("/api/seguidores/usuario/" + b.username() + "/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seguidores").value(1))
                .andExpect(jsonPath("$.seguidos").value(0));

        mvc.perform(get("/api/seguidores/usuario/" + a.username() + "/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seguidores").value(0))
                .andExpect(jsonPath("$.seguidos").value(1));
    }

    @Test
    void seguirDosVecesEsIdempotenteNoCuentaDoble() throws Exception {
        Sesion a = crear("follow_carla", "follow_carla@example.com");
        Sesion b = crear("follow_diana", "follow_diana@example.com");

        mvc.perform(post("/api/seguidores/" + b.id())
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(jsonPath("$.nuevo").value(true));

        // Segundo follow → nuevo=false porque ya existía la relación.
        mvc.perform(post("/api/seguidores/" + b.id())
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nuevo").value(false));

        mvc.perform(get("/api/seguidores/usuario/" + b.username() + "/stats"))
                .andExpect(jsonPath("$.seguidores").value(1));
    }

    @Test
    void dejarDeSeguirBorraLaRelacion() throws Exception {
        Sesion a = crear("follow_eva", "follow_eva@example.com");
        Sesion b = crear("follow_fran", "follow_fran@example.com");

        mvc.perform(post("/api/seguidores/" + b.id())
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/seguidores/" + b.id())
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seguido").value(false))
                .andExpect(jsonPath("$.borrado").value(true));

        mvc.perform(get("/api/seguidores/usuario/" + b.username() + "/stats"))
                .andExpect(jsonPath("$.seguidores").value(0));
    }

    @Test
    void statsConCallerAutenticadoIncluyeFlagSiguiendo() throws Exception {
        Sesion a = crear("follow_gloria", "follow_gloria@example.com");
        Sesion b = crear("follow_hugo", "follow_hugo@example.com");

        mvc.perform(post("/api/seguidores/" + b.id())
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk());

        // Stats de hugo desde el contexto de alice → siguiendo=true
        mvc.perform(get("/api/seguidores/usuario/" + b.username() + "/stats")
                .header("Authorization", "Bearer " + a.token()))
                .andExpect(jsonPath("$.siguiendo").value(true))
                .andExpect(jsonPath("$.esMismoUsuario").value(false));

        // Stats de hugo desde el propio hugo → esMismoUsuario=true
        mvc.perform(get("/api/seguidores/usuario/" + b.username() + "/stats")
                .header("Authorization", "Bearer " + b.token()))
                .andExpect(jsonPath("$.esMismoUsuario").value(true));

        // Stats sin auth → siguiendo=false
        mvc.perform(get("/api/seguidores/usuario/" + b.username() + "/stats"))
                .andExpect(jsonPath("$.siguiendo").value(false));
    }
}
