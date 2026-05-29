package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.TestAsyncConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración del perfil del usuario.
 *
 * <p>Cubre los 3 endpoints {@code /api/perfil/me/*} con auth, sin auth y
 * con datos básicos generados in-test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class PerfilControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private com.diegoalegil.animeshowdown.repository.UsuarioRepository usuarioRepository;

    private String tokenDe(String username, String email) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))));
        var res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    private String tokenAdmin() throws Exception {
        String token = tokenDe("admin_torneo_test", "diegogildam@gmail.com");
        // Tras revisión: la promoción a ADMIN ya no ocurre en
        // registro. Forzamos verificación + ADMIN en BBDD para tests.
        usuarioRepository.findByUsername("admin_torneo_test").ifPresent(u -> {
            u.setEstadoVerificacion(com.diegoalegil.animeshowdown.model.EstadoVerificacion.ACTIVO);
            u.setRol(com.diegoalegil.animeshowdown.model.Rol.ADMIN);
            usuarioRepository.save(u);
        });
        return token;
    }

    @Test
    void statsSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(get("/api/perfil/me/stats"))
                .andExpect(status().isForbidden());
    }

    @Test
    void statsUsuarioNuevoDevuelveCeros() throws Exception {
        String token = tokenDe("perfil_alice", "perfil_alice@example.com");
        mvc.perform(get("/api/perfil/me/stats")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.votosTotales").value(0))
                .andExpect(jsonPath("$.prediccionesAcertadas").value(0))
                .andExpect(jsonPath("$.porcentajeAciertos").value(0.0))
                .andExpect(jsonPath("$.badgesDesbloqueados").value(0));
    }

    @Test
    void historialUsuarioNuevoDevuelveEmpty() throws Exception {
        String token = tokenDe("perfil_bob", "perfil_bob@example.com");
        mvc.perform(get("/api/perfil/me/historial-votos")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void topUsuarioNuevoDevuelveListaVacia() throws Exception {
        String token = tokenDe("perfil_carla", "perfil_carla@example.com");
        mvc.perform(get("/api/perfil/me/top?limit=5")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void perfilPublicoSinAuthDevuelveStatsYFlags() throws Exception {
        // Registra el usuario para que exista, sin tokens necesarios para la lectura.
        tokenDe("perfil_publico_anon", "perfil_publico_anon@example.com");

        mvc.perform(get("/api/perfil/perfil_publico_anon"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("perfil_publico_anon"))
                .andExpect(jsonPath("$.esMismoUsuario").value(false))
                .andExpect(jsonPath("$.siguiendo").doesNotExist())
                .andExpect(jsonPath("$.seguidores").value(0))
                .andExpect(jsonPath("$.seguidos").value(0))
                .andExpect(jsonPath("$.stats.votosTotales").value(0))
                .andExpect(jsonPath("$.top").isArray())
                .andExpect(jsonPath("$.logros").isArray());
    }

    @Test
    void perfilPublicoUsernameInexistenteDevuelve404() throws Exception {
        mvc.perform(get("/api/perfil/no_existe_jamas_42"))
                .andExpect(status().isNotFound());
    }

    @Test
    void perfilPublicoConCallerDistintoTraeSiguiendoFalse() throws Exception {
        tokenDe("perfil_target_x", "perfil_target_x@example.com");
        String callerToken = tokenDe("perfil_caller_y", "perfil_caller_y@example.com");

        mvc.perform(get("/api/perfil/perfil_target_x")
                .header("Authorization", "Bearer " + callerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.esMismoUsuario").value(false))
                .andExpect(jsonPath("$.siguiendo").value(false));
    }

    @Test
    void perfilPublicoConCallerIgualMarcaEsMismoUsuario() throws Exception {
        String token = tokenDe("perfil_self_z", "perfil_self_z@example.com");

        mvc.perform(get("/api/perfil/perfil_self_z")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.esMismoUsuario").value(true))
                .andExpect(jsonPath("$.siguiendo").doesNotExist());
    }

    @Test
    void historialTrasUnVotoReflejaElEnfrentamiento() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenDe("perfil_diana", "perfil_diana@example.com");

        // Setup: torneo + enfrentamiento
        MvcResult resPers = mvc.perform(get("/api/personajes")).andReturn();
        JsonNode personajes = json.readTree(resPers.getResponse().getContentAsString());
        long luffy = -1, zoro = -1;
        for (JsonNode p : personajes) {
            if ("luffy".equals(p.get("slug").asText())) luffy = p.get("id").asLong();
            if ("zoro".equals(p.get("slug").asText())) zoro = p.get("id").asLong();
        }
        MvcResult resT = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("nombre", "Perfil Hist", "descripcion", "test"))))
                .andReturn();
        long torneoId = json.readTree(resT.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/torneos/" + torneoId + "/iniciar")
                .header("Authorization", "Bearer " + adminToken)).andExpect(status().isOk());
        MvcResult resE = mvc.perform(post("/api/torneos/" + torneoId + "/enfrentamientos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        List.of(Map.of("personaje1Id", luffy, "personaje2Id", zoro)))))
                .andReturn();
        long enfId = json.readTree(resE.getResponse().getContentAsString()).get(0).get("id").asLong();

        // Diana vota a Luffy
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", luffy))))
                .andExpect(status().isOk());

        // El historial muestra el voto con el oponente y el torneo poblados.
        mvc.perform(get("/api/perfil/me/historial-votos")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].personajeSlug").value("luffy"))
                .andExpect(jsonPath("$.content[0].oponenteSlug").value("zoro"))
                .andExpect(jsonPath("$.content[0].torneoId").value(torneoId));

        // Stats refleja votosTotales=1
        mvc.perform(get("/api/perfil/me/stats")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.votosTotales").value(1));

        // Top refleja luffy con 1 voto
        mvc.perform(get("/api/perfil/me/top")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].slug").value("luffy"))
                .andExpect(jsonPath("$[0].votos").value(1));
    }

    @Test
    void eliminarCuentaSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(delete("/api/perfil/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "loquesea"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void eliminarCuentaConPasswordIncorrectaDevuelve400() throws Exception {
        String token = tokenDe("delete_alice", "delete_alice@example.com");
        mvc.perform(delete("/api/perfil/me")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "passwordIncorrecta"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password incorrecta"));
    }

    @Test
    void eliminarCuentaOkBorraUsuarioYReturnNoContent() throws Exception {
        String token = tokenDe("delete_bob", "delete_bob@example.com");
        mvc.perform(delete("/api/perfil/me")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "secreta123"))))
                .andExpect(status().isNoContent());

        // Verifica que tras el delete el perfil público devuelve 404.
        mvc.perform(get("/api/perfil/delete_bob"))
                .andExpect(status().isNotFound());

        // Y que el JWT antiguo ya no puede acceder a /me/stats (usuario
        // no existe → AuthenticationPrincipal queda null → 401/403).
        mvc.perform(get("/api/perfil/me/stats")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void eliminarCuentaSinPasswordEnBodyDevuelve400() throws Exception {
        String token = tokenDe("delete_carla", "delete_carla@example.com");
        mvc.perform(delete("/api/perfil/me")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void actividadSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(get("/api/perfil/me/actividad"))
                .andExpect(status().isForbidden());
    }

    @Test
    void actividadUsuarioNuevoDevuelveListaVacia() throws Exception {
        String token = tokenDe("activ_alice", "activ_alice@example.com");
        mvc.perform(get("/api/perfil/me/actividad")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void bioSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(patch("/api/perfil/me/bio")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bio", "hola"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void bioSeGuardaYApareceEnPerfilPublico() throws Exception {
        String token = tokenDe("bio_alice", "bio_alice@example.com");
        mvc.perform(patch("/api/perfil/me/bio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bio", "Fan de One Piece desde 2010"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value("Fan de One Piece desde 2010"));

        // La vista pública refleja la bio + fechaRegistro (B7 §1a/§1b).
        mvc.perform(get("/api/perfil/bio_alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value("Fan de One Piece desde 2010"))
                .andExpect(jsonPath("$.fechaRegistro").exists());
    }

    @Test
    void bioConHtmlSeGuardaComoTextoPlano() throws Exception {
        String token = tokenDe("bio_bob", "bio_bob@example.com");
        mvc.perform(patch("/api/perfil/me/bio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("bio", "<b>Hola</b> <script>x</script>mundo"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value("Hola xmundo"));
    }

    @Test
    void bioVaciaLaBorra() throws Exception {
        String token = tokenDe("bio_carla", "bio_carla@example.com");
        mvc.perform(patch("/api/perfil/me/bio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bio", "algo"))))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/perfil/me/bio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bio", "   "))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").doesNotExist());
    }

    @Test
    void bioDemasiadoLargaDevuelve400() throws Exception {
        String token = tokenDe("bio_dario", "bio_dario@example.com");
        mvc.perform(patch("/api/perfil/me/bio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("bio", "a".repeat(241)))))
                .andExpect(status().isBadRequest());
    }
}
