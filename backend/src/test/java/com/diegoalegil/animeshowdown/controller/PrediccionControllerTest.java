package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración de predicciones de bracket (Plan v2 §4.4).
 *
 * <p>Cubre el flow completo end-to-end:
 * <ul>
 *   <li>Crear predicción válida → 200 con el DTO.</li>
 *   <li>Sin auth → 403.</li>
 *   <li>Personaje fuera del match → 400 con mensaje claro.</li>
 *   <li>Re-aplicar (mismo match, distinto personaje) → UPDATE, sin
 *       duplicar filas.</li>
 *   <li>Listar mis predicciones de un torneo.</li>
 *   <li>Flow completo: predecir → finalizar torneo → la predicción aparece
 *       resuelta (acertada=true/false).</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class PrediccionControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;

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

    // Auditoría P1.1 (2026-05-17): la auto-promoción a ADMIN ocurre tras verificar
    // email (EmailVerificationService), no en /registro. El helper registra y
    // luego fuerza ACTIVO + ADMIN directamente en BBDD para simular el flow.
    private String tokenAdmin() throws Exception {
        String token = tokenDe("admin_torneo_test", "diegogildam@gmail.com");
        usuarioRepository.findByUsername("admin_torneo_test").ifPresent(u -> {
            u.setEstadoVerificacion(EstadoVerificacion.ACTIVO);
            u.setRol(Rol.ADMIN);
            usuarioRepository.save(u);
        });
        return token;
    }

    private long[] dosPersonajes() throws Exception {
        MvcResult res = mvc.perform(get("/api/personajes"))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());
        long luffy = -1, zoro = -1;
        for (JsonNode p : arr) {
            if ("luffy".equals(p.get("slug").asText())) luffy = p.get("id").asLong();
            if ("zoro".equals(p.get("slug").asText())) zoro = p.get("id").asLong();
        }
        return new long[] { luffy, zoro };
    }

    private record Setup(long torneoId, long enfId, long p1, long p2) {}

    /** Crea torneo activo con un enfrentamiento entre 2 personajes. */
    private Setup crearTorneoConMatch(String adminToken, String suffix) throws Exception {
        long[] ids = dosPersonajes();
        MvcResult resT = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("nombre", "Pred " + suffix, "descripcion", "test"))))
                .andExpect(status().isOk()).andReturn();
        long torneoId = json.readTree(resT.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/torneos/" + torneoId + "/iniciar")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        MvcResult resE = mvc.perform(post("/api/torneos/" + torneoId + "/enfrentamientos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        List.of(Map.of("personaje1Id", ids[0], "personaje2Id", ids[1])))))
                .andExpect(status().isCreated()).andReturn();
        long enfId = json.readTree(resE.getResponse().getContentAsString()).get(0).get("id").asLong();
        return new Setup(torneoId, enfId, ids[0], ids[1]);
    }

    @Test
    void crearPrediccionSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(post("/api/predicciones")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("enfrentamientoId", 1L, "personajePredichoId", 1L))))
                .andExpect(status().isForbidden());
    }

    @Test
    void crearPrediccionValidaDevuelve200() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenDe("pred_alice", "pred_alice@example.com");
        Setup s = crearTorneoConMatch(adminToken, "alice");

        mvc.perform(post("/api/predicciones")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "enfrentamientoId", s.enfId(),
                        "personajePredichoId", s.p1()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enfrentamientoId").value(s.enfId()))
                .andExpect(jsonPath("$.personajePredichoId").value(s.p1()))
                .andExpect(jsonPath("$.acertada").doesNotExist());
    }

    @Test
    void prediccionConPersonajeAjenoAlMatchDevuelve400() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenDe("pred_bob", "pred_bob@example.com");
        Setup s = crearTorneoConMatch(adminToken, "bob");

        // Un id que no es ni p1 ni p2 — pick uno aleatorio del catálogo.
        long ajeno = (s.p1() == 1 ? 999_999 : 1);

        mvc.perform(post("/api/predicciones")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "enfrentamientoId", s.enfId(),
                        "personajePredichoId", ajeno))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reaplicarPrediccionCambiaElPersonajeSinDuplicar() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenDe("pred_carla", "pred_carla@example.com");
        Setup s = crearTorneoConMatch(adminToken, "carla");

        // Primera predicción: p1
        mvc.perform(post("/api/predicciones")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "enfrentamientoId", s.enfId(),
                        "personajePredichoId", s.p1()))))
                .andExpect(status().isOk());

        // Cambia a p2
        mvc.perform(post("/api/predicciones")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "enfrentamientoId", s.enfId(),
                        "personajePredichoId", s.p2()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personajePredichoId").value(s.p2()));

        // /mias del torneo: 1 sola predicción (no duplicada).
        mvc.perform(get("/api/predicciones/mias/torneo/" + s.torneoId())
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].personajePredichoId").value(s.p2()));
    }

    @Test
    void leaderboardEsPublico() throws Exception {
        mvc.perform(get("/api/predicciones/leaderboard?dias=30&limit=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void prediccionResueltaTrasFinalizarTorneo() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenDe("pred_diana", "pred_diana@example.com");
        Setup s = crearTorneoConMatch(adminToken, "diana");

        // Diana predice p1.
        mvc.perform(post("/api/predicciones")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "enfrentamientoId", s.enfId(),
                        "personajePredichoId", s.p1()))))
                .andExpect(status().isOk());

        // Un usuario vota a p1 → será el ganador cuando se finalice.
        String votanteToken = tokenDe("pred_votante", "pred_votante@example.com");
        mvc.perform(post("/api/enfrentamientos/" + s.enfId() + "/votar")
                .header("Authorization", "Bearer " + votanteToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", s.p1()))))
                .andExpect(status().isOk());

        // Admin finaliza el torneo → debería resolver la predicción.
        mvc.perform(put("/api/torneos/" + s.torneoId() + "/finalizar")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // La predicción de Diana ahora está acertada=true.
        mvc.perform(get("/api/predicciones/mias/torneo/" + s.torneoId())
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].acertada").value(true));
    }
}
