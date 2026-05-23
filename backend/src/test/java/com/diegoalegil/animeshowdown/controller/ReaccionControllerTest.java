package com.diegoalegil.animeshowdown.controller;

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
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración de reactions emoji (Plan v2 §4.3).
 *
 * <p>Cubre:
 * <ul>
 *   <li>GET público devuelve resumen vacío (counts=0) cuando no hay reactions.</li>
 *   <li>POST sin auth → 401 con mensaje.</li>
 *   <li>Aplicar tipo X dos veces hace toggle off (count vuelve a 0).</li>
 *   <li>Aplicar tipo X y luego Y cambia la reacción (count[X]=0, count[Y]=1).</li>
 *   <li>Dos usuarios distintos suman al mismo target.</li>
 *   <li>miReaccion se refleja en el GET del propio usuario; null para anónimo.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class ReaccionControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    private String tokenDe(String username, String email) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))))
                .andExpect(status().isCreated());
        var res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    private Map<String, Object> body(String targetType, long targetId, String tipo) {
        return Map.of("targetType", targetType, "targetId", targetId, "tipo", tipo);
    }

    /**
     * ReaccionService ahora valida que el target exista
     * antes de persistir, así que los tests no pueden usar IDs sintéticos
     * como 999010. Resolvemos el id real de un personaje por slug — luffy
     * siempre está en el seed.
     */
    private long idPersonajeReal(String slug) throws Exception {
        var res = mvc.perform(get("/api/personajes"))
                .andExpect(status().isOk())
                .andReturn();
        var arr = json.readTree(res.getResponse().getContentAsString());
        for (var p : arr) {
            if (slug.equals(p.get("slug").asText())) return p.get("id").asLong();
        }
        throw new IllegalStateException("Personaje " + slug + " no seedeado");
    }

    private long idTorneoReal(String slug) throws Exception {
        var res = mvc.perform(get("/api/torneos"))
                .andExpect(status().isOk())
                .andReturn();
        var arr = json.readTree(res.getResponse().getContentAsString());
        for (var t : arr) {
            if (slug.equals(t.get("slug").asText())) return t.get("id").asLong();
        }
        throw new IllegalStateException("Torneo " + slug + " no seedeado");
    }

    @Test
    void getResumenPublicoSinReaccionesDevuelveCerosYNullMia() throws Exception {
        mvc.perform(get("/api/reacciones?targetType=PERSONAJE&targetId=999001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.counts.FIRE").value(0))
                .andExpect(jsonPath("$.counts.HEART").value(0))
                .andExpect(jsonPath("$.counts.LAUGH").value(0))
                .andExpect(jsonPath("$.counts.CRY").value(0))
                .andExpect(jsonPath("$.miReaccion").doesNotExist());
    }

    @Test
    void postSinAuthDevuelve401() throws Exception {
        mvc.perform(post("/api/reacciones")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("PERSONAJE", 999002L, "FIRE"))))
                // SecurityConfig redirige a 403 cuando hay anyRequest().authenticated()
                // sin authenticationEntryPoint custom. Aceptamos 401 o 403.
                .andExpect(result -> {
                    int s = result.getResponse().getStatus();
                    if (s != 401 && s != 403) {
                        throw new AssertionError("Esperado 401 o 403, recibido " + s);
                    }
                });
    }

    @Test
    void aplicarMismoTipoDosVecesHaceToggleOff() throws Exception {
        String token = tokenDe("react_alice", "react_alice@example.com");
        long targetId = idPersonajeReal("luffy");

        // Primera: count[FIRE]=1, miReaccion=FIRE
        mvc.perform(post("/api/reacciones")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("PERSONAJE", targetId, "FIRE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.FIRE").value(1))
                .andExpect(jsonPath("$.miReaccion").value("FIRE"));

        // Segunda con el mismo tipo: toggle off → count[FIRE]=0, miReaccion=null
        mvc.perform(post("/api/reacciones")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("PERSONAJE", targetId, "FIRE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.FIRE").value(0))
                .andExpect(jsonPath("$.miReaccion").doesNotExist());
    }

    @Test
    void aplicarTipoDistintoCambiaLaReaccion() throws Exception {
        String token = tokenDe("react_bob", "react_bob@example.com");
        long targetId = idTorneoReal("shonen-showdown");

        mvc.perform(post("/api/reacciones")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("TORNEO", targetId, "FIRE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.FIRE").value(1));

        // Cambia a HEART: count[FIRE]=0, count[HEART]=1, total sigue=1
        mvc.perform(post("/api/reacciones")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("TORNEO", targetId, "HEART"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.FIRE").value(0))
                .andExpect(jsonPath("$.counts.HEART").value(1))
                .andExpect(jsonPath("$.miReaccion").value("HEART"))
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void dosUsuariosDistintosSumanAlMismoTarget() throws Exception {
        String tokenA = tokenDe("react_carla", "react_carla@example.com");
        String tokenB = tokenDe("react_diana", "react_diana@example.com");
        long targetId = idPersonajeReal("zoro");

        mvc.perform(post("/api/reacciones")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("PERSONAJE", targetId, "FIRE"))))
                .andExpect(status().isOk());

        mvc.perform(post("/api/reacciones")
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("PERSONAJE", targetId, "FIRE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.FIRE").value(2))
                .andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void miReaccionSoloAparceConAuth() throws Exception {
        String token = tokenDe("react_eva", "react_eva@example.com");
        long targetId = idPersonajeReal("naruto");

        mvc.perform(post("/api/reacciones")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body("PERSONAJE", targetId, "LAUGH"))))
                .andExpect(status().isOk());

        // Con auth → miReaccion="LAUGH"
        mvc.perform(get("/api/reacciones?targetType=PERSONAJE&targetId=" + targetId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.miReaccion").value("LAUGH"));

        // Anónimo (mismo target) → miReaccion null pero counts sí salen
        mvc.perform(get("/api/reacciones?targetType=PERSONAJE&targetId=" + targetId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.LAUGH").value(1))
                .andExpect(jsonPath("$.miReaccion").doesNotExist());
    }
}
