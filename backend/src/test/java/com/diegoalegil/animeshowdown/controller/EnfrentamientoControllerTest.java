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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests del flujo completo de votación en enfrentamientos:
 *  1. ADMIN crea torneo + lo inicia.
 *  2. ADMIN crea enfrentamiento entre dos personajes existentes (DataSeeder cargó 125).
 *  3. USER autenticado vota → 200, segundo voto duplicado → 409.
 *  4. Vote sin auth, en torneo no ACTIVO, o con personaje ajeno al enfrentamiento → respectivos errores.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EnfrentamientoControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private com.diegoalegil.animeshowdown.repository.UsuarioRepository usuarioRepository;

    private String tokenUserRegistrado(String username, String email) throws Exception {
        Map<String, String> reg = Map.of(
                "username", username,
                "password", "secreta123",
                "email", email);
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)));

        Map<String, String> login = Map.of(
                "username", username,
                "password", "secreta123");
        MvcResult res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    private String tokenAdmin() throws Exception {
        // Mismo username que TorneoControllerTest para que el contexto Spring cacheado
        // sirva tanto si arranca primero un test como otro (el email diegogildam@gmail.com
        // ya está registrado por el primero, no se puede registrar dos veces).
        // Tras auditoría P1.1, la promoción a ADMIN ya no ocurre en registro;
        // forzamos verificación + ADMIN en BBDD para simular el flow completo.
        String token = tokenUserRegistrado("admin_torneo_test", "diegogildam@gmail.com");
        usuarioRepository.findByUsername("admin_torneo_test").ifPresent(u -> {
            u.setEstadoVerificacion(com.diegoalegil.animeshowdown.model.EstadoVerificacion.ACTIVO);
            u.setRol(com.diegoalegil.animeshowdown.model.Rol.ADMIN);
            usuarioRepository.save(u);
        });
        return token;
    }

    /** Devuelve los ids reales de dos personajes seedeados (luffy y zoro por convención). */
    private long[] dosPersonajes() throws Exception {
        MvcResult res = mvc.perform(get("/api/personajes"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());
        long luffy = -1, zoro = -1;
        for (JsonNode p : arr) {
            if ("luffy".equals(p.get("slug").asText())) luffy = p.get("id").asLong();
            if ("zoro".equals(p.get("slug").asText())) zoro = p.get("id").asLong();
        }
        if (luffy < 0 || zoro < 0) {
            throw new IllegalStateException("DataSeeder no cargó luffy/zoro en H2");
        }
        return new long[] { luffy, zoro };
    }

    /** Crea torneo + lo inicia + crea enfrentamiento entre p1 y p2. Devuelve el id del enfrentamiento. */
    private long crearEnfrentamientoListoParaVotar(String adminToken, long p1, long p2, String suffix) throws Exception {
        Map<String, String> body = Map.of(
                "nombre", "Torneo Voto " + suffix,
                "descripcion", "test voto");
        MvcResult resTorneo = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        long torneoId = json.readTree(resTorneo.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/torneos/" + torneoId + "/iniciar")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        List<Map<String, Long>> enfBody = List.of(Map.of("personaje1Id", p1, "personaje2Id", p2));
        MvcResult resEnf = mvc.perform(post("/api/torneos/" + torneoId + "/enfrentamientos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(enfBody)))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(resEnf.getResponse().getContentAsString()).get(0).get("id").asLong();
    }

    @Test
    void votarSinAuthDevuelveForbidden() throws Exception {
        // No necesitamos enfrentamiento real — debería rebotar en el filtro JWT antes.
        Map<String, Long> body = Map.of("personajeGanadorId", 1L);

        mvc.perform(post("/api/enfrentamientos/1/votar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void votarSobreEnfrentamientoInexistenteDevuelve404() throws Exception {
        String tokenUser = tokenUserRegistrado("voto_404_user", "voto404@example.com");
        Map<String, Long> body = Map.of("personajeGanadorId", 1L);

        mvc.perform(post("/api/enfrentamientos/9999999/votar")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isNotFound());
    }

    @Test
    void votarValidoDevuelve200YPersisteVoto() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_ok_user", "votook@example.com");
        long[] ids = dosPersonajes();

        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "valido");

        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                // Tras propuesta §4.x: el endpoint devuelve VotoRegistradoDto
                // con counts post-voto y delta, no la entidad Voto cruda.
                .andExpect(jsonPath("$.votoId").isNumber())
                .andExpect(jsonPath("$.personajeGanadorId").value(ids[0]))
                .andExpect(jsonPath("$.votosGanador").value(1))
                .andExpect(jsonPath("$.personajePerdedorId").value(ids[1]))
                .andExpect(jsonPath("$.votosPerdedor").value(0))
                .andExpect(jsonPath("$.delta").value(1));
    }

    @Test
    void votarDosVecesElMismoEnfrentamientoDevuelve409() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_doble_user", "votodoble@example.com");
        long[] ids = dosPersonajes();

        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "doble");

        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk());

        // Segundo voto del mismo usuario al mismo enfrentamiento → 409
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isConflict());
    }

    @Test
    void votarConPersonajeQueNoEsDelEnfrentamientoDevuelve400() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_ajeno_user", "votoajeno@example.com");
        long[] ids = dosPersonajes();

        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "ajeno");

        // Buscar un personaje cuyo id NO esté en el enfrentamiento
        long ajenoId = ids[0] == 1 ? 3 : 1;
        Map<String, Long> body = Map.of("personajeGanadorId", ajenoId);

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void votarSobreEnfrentamientoDeTorneoNoActivoDevuelve409() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_borrador_user", "votoborrador@example.com");
        long[] ids = dosPersonajes();

        // Crea torneo, NO lo inicia (queda en BORRADOR), añade enfrentamiento
        Map<String, String> body = Map.of(
                "nombre", "Torneo Borrador Voto",
                "descripcion", "test no activo");
        MvcResult resTorneo = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        long torneoId = json.readTree(resTorneo.getResponse().getContentAsString()).get("id").asLong();

        List<Map<String, Long>> enfBody = List.of(Map.of("personaje1Id", ids[0], "personaje2Id", ids[1]));
        MvcResult resEnf = mvc.perform(post("/api/torneos/" + torneoId + "/enfrentamientos")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(enfBody)))
                .andExpect(status().isCreated())
                .andReturn();
        long enfId = json.readTree(resEnf.getResponse().getContentAsString()).get(0).get("id").asLong();

        Map<String, Long> voto = Map.of("personajeGanadorId", ids[0]);
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(voto)))
                .andExpect(status().isConflict());
    }
}
