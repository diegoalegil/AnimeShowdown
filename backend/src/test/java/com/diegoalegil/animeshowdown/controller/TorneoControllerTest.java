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

import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests de integración del TorneoController contra H2 in-memory.
 * Autentica registrando usuarios reales y obteniendo JWT por /api/auth/login,
 * en lugar de @WithMockUser porque el controller usa @AuthenticationPrincipal Usuario
 * (la entidad real, no User de Spring Security) — el mock no la inyectaría correctamente.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TorneoControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PersonajeRepository personajeRepository;

    /**
     * Asegura un user con esas credenciales (idempotente entre tests). Si ya existe
     * en H2 (contexto Spring cacheado entre métodos), salta el registro y va al login.
     * Devuelve el JWT.
     */
    private String tokenUserRegistrado(String username, String email) throws Exception {
        Map<String, String> reg = Map.of(
                "username", username,
                "password", "secreta123",
                "email", email);
        // Registro: ignora 409 (ya existe de un test previo)
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

        JsonNode body = json.readTree(res.getResponse().getContentAsString());
        return body.get("token").asText();
    }

    /** El email diegogildam@gmail.com se auto-promueve a ADMIN (admin.emails default). */
    private String tokenAdmin() throws Exception {
        return tokenUserRegistrado("admin_torneo_test", "diegogildam@gmail.com");
    }

    @Test
    void getTorneosEsPublico() throws Exception {
        mvc.perform(get("/api/torneos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void crearTorneoSinAuthDevuelveForbidden() throws Exception {
        // Spring Security sin AuthenticationEntryPoint custom devuelve 403 para
        // peticiones sin token (no 401). Lo importante es que NO entra.
        Map<String, String> body = Map.of(
                "nombre", "Torneo Anónimo",
                "descripcion", "No debería entrar");

        mvc.perform(post("/api/torneos")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void crearTorneoConRolUserDevuelve403() throws Exception {
        String tokenUser = tokenUserRegistrado("user_torneo_test", "user_torneo@example.com");

        Map<String, String> body = Map.of(
                "nombre", "Torneo Usuario",
                "descripcion", "USER no puede crear");

        mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void crearTorneoComoAdminDevuelve200ConIdYEstadoBorrador() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Admin Test",
                "descripcion", "Torneo creado en test");

        mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nombre").value("Torneo Admin Test"))
                .andExpect(jsonPath("$.estado").value("SCHEDULED"));
    }

    @Test
    void iniciarTorneoScheduledPasaAEstadoInProgress() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Para Iniciar",
                "descripcion", "Test");

        MvcResult res = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.fechaInicio").isString());
    }

    @Test
    void iniciarTorneoYaInProgressDevuelve409() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Doble Iniciar",
                "descripcion", "Test 409");

        MvcResult res = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Segundo iniciar sobre torneo IN_PROGRESS → 409
        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    @Test
    void iniciarTorneoInexistenteDevuelve404() throws Exception {
        String token = tokenAdmin();

        mvc.perform(put("/api/torneos/9999999/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    private String tokenUserVerificado(String username, String email) throws Exception {
        String token = tokenUserRegistrado(username, email);
        // Plan v2 §2.4: registros nacen PENDIENTE. Para el flow §4.9 el user
        // necesita estar verificado — lo flippeamos directo en DB en el test.
        var u = usuarioRepository.findByUsername(username).orElseThrow();
        u.setEstadoVerificacion(EstadoVerificacion.ACTIVO);
        usuarioRepository.save(u);
        return token;
    }

    private List<Long> primerosNPersonajes(int n) {
        return personajeRepository.findAll().stream()
                .limit(n)
                .map(p -> p.getId())
                .toList();
    }

    @Test
    void crearMioSinAuthDevuelve403() throws Exception {
        mvc.perform(post("/api/torneos/mio")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Anon torneo",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isForbidden());
    }

    @Test
    void crearMioConUserNoVerificadoDevuelve400() throws Exception {
        String token = tokenUserRegistrado("user_no_verif_torneo", "user_no_verif_torneo@example.com");

        mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Mi torneo pendiente verif",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void crearMioCon7PersonajesDevuelve400() throws Exception {
        String token = tokenUserVerificado("user_7_pers", "user_7_pers@example.com");

        mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Numero raro",
                        "participantesIds", primerosNPersonajes(7)))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void crearMioCon8PersonajesDevuelve201YPendiente() throws Exception {
        String token = tokenUserVerificado("user_torneo_mio", "user_torneo_mio@example.com");

        mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Mi primer torneo",
                        "descripcion", "Probando creacion por user",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nombre").value("Mi primer torneo"))
                .andExpect(jsonPath("$.estadoRevision").value("PENDIENTE"))
                .andExpect(jsonPath("$.estado").value("SCHEDULED"));
    }

    @Test
    void torneoMioPendienteNoAparece_enListadoPublico() throws Exception {
        String token = tokenUserVerificado("user_torneo_oculto", "user_torneo_oculto@example.com");

        MvcResult res = mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Torneo invisible",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated())
                .andReturn();
        String slugCreado = json.readTree(res.getResponse().getContentAsString())
                .get("slug").asText();

        // El listado público no incluye torneos PENDIENTES.
        MvcResult listado = mvc.perform(get("/api/torneos"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(listado.getResponse().getContentAsString());
        boolean encontrado = false;
        for (JsonNode t : arr) {
            if (slugCreado.equals(t.get("slug").asText())) encontrado = true;
        }
        org.junit.jupiter.api.Assertions.assertFalse(encontrado,
                "Torneo PENDIENTE no debería estar en /api/torneos público");

        // Y findBySlug devuelve 404 mientras esté PENDIENTE.
        mvc.perform(get("/api/torneos/slug/" + slugCreado))
                .andExpect(status().isNotFound());
    }

    @Test
    void misTorneosDevuelveTorneosDelCreadorConEstadoRevision() throws Exception {
        String token = tokenUserVerificado("user_mios_test", "user_mios_test@example.com");

        mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Mio para listar",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/torneos/mios")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].nombre").value("Mio para listar"))
                .andExpect(jsonPath("$[0].estadoRevision").value("PENDIENTE"));
    }

    @Test
    void misTorneosSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(get("/api/torneos/mios"))
                .andExpect(status().isForbidden());
    }

    @Test
    void admin_listarPendientes_devuelveTorneoCreadoPorUser() throws Exception {
        String tokenUser = tokenUserVerificado("user_admin_aprueba", "user_admin_aprueba@example.com");
        String tokenAdmin = tokenAdmin();

        // User envía propuesta
        mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Para que admin lo apruebe",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated());

        // Admin ve la cola
        mvc.perform(get("/api/admin/torneos/pendientes")
                .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.nombre == 'Para que admin lo apruebe')]").exists());
    }

    @Test
    void admin_aprobar_marcaTorneoAprobadoEInProgress() throws Exception {
        String tokenUser = tokenUserVerificado("user_aprobar_target", "user_aprobar_target@example.com");
        String tokenAdmin = tokenAdmin();

        MvcResult res = mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "A aprobar",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/admin/torneos/" + id + "/aprobar")
                .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estadoRevision").value("APROBADO"))
                .andExpect(jsonPath("$.estado").value("IN_PROGRESS"));

        // Ahora SÍ aparece en el listado público
        MvcResult list = mvc.perform(get("/api/torneos"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(list.getResponse().getContentAsString());
        boolean encontrado = false;
        for (JsonNode t : arr) {
            if ("A aprobar".equals(t.get("nombre").asText())) encontrado = true;
        }
        org.junit.jupiter.api.Assertions.assertTrue(encontrado,
                "Torneo APROBADO debería aparecer en /api/torneos público");
    }

    @Test
    void admin_rechazar_marcaTorneoRechazadoConMotivo() throws Exception {
        String tokenUser = tokenUserVerificado("user_rechazar_target", "user_rechazar_target@example.com");
        String tokenAdmin = tokenAdmin();

        MvcResult res = mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "A rechazar",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/admin/torneos/" + id + "/rechazar")
                .header("Authorization", "Bearer " + tokenAdmin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("motivo", "Personajes repetidos en distintos animes"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estadoRevision").value("RECHAZADO"))
                .andExpect(jsonPath("$.motivoRechazo").value("Personajes repetidos en distintos animes"));

        // El creador ve el rechazo + motivo en /mios
        mvc.perform(get("/api/torneos/mios")
                .header("Authorization", "Bearer " + tokenUser))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.nombre == 'A rechazar')].estadoRevision").value("RECHAZADO"))
                .andExpect(jsonPath("$[?(@.nombre == 'A rechazar')].motivoRechazo")
                        .value("Personajes repetidos en distintos animes"));
    }

    @Test
    void admin_aprobar_torneoYaAprobado_devuelve409() throws Exception {
        String tokenUser = tokenUserVerificado("user_doble_aprobar", "user_doble_aprobar@example.com");
        String tokenAdmin = tokenAdmin();

        MvcResult res = mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Doble aprobacion",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/admin/torneos/" + id + "/aprobar")
                .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk());
        mvc.perform(put("/api/admin/torneos/" + id + "/aprobar")
                .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isConflict());
    }

    @Test
    void admin_rechazar_sinMotivo_devuelve400() throws Exception {
        String tokenUser = tokenUserVerificado("user_rechazar_sin_motivo", "user_rechazar_sin_motivo@example.com");
        String tokenAdmin = tokenAdmin();

        MvcResult res = mvc.perform(post("/api/torneos/mio")
                .header("Authorization", "Bearer " + tokenUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "nombre", "Sin motivo",
                        "participantesIds", primerosNPersonajes(8)))))
                .andExpect(status().isCreated())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/admin/torneos/" + id + "/rechazar")
                .header("Authorization", "Bearer " + tokenAdmin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("motivo", ""))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void admin_aprobar_sinAdmin_devuelve403() throws Exception {
        String tokenUser = tokenUserVerificado("user_no_admin_aprueba", "user_no_admin_aprueba@example.com");

        mvc.perform(put("/api/admin/torneos/9999/aprobar")
                .header("Authorization", "Bearer " + tokenUser))
                .andExpect(status().isForbidden());
    }

    @Test
    void finalizarTorneoSoloFuncionaSiEstaInProgress() throws Exception {
        String token = tokenAdmin();

        Map<String, String> body = Map.of(
                "nombre", "Torneo Finalizar",
                "descripcion", "Test finalizar");

        MvcResult res = mvc.perform(post("/api/torneos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Long id = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        // Finalizar SCHEDULED → 409
        mvc.perform(put("/api/torneos/" + id + "/finalizar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());

        // Iniciar → IN_PROGRESS
        mvc.perform(put("/api/torneos/" + id + "/iniciar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Finalizar IN_PROGRESS → 200, estado FINISHED
        mvc.perform(put("/api/torneos/" + id + "/finalizar")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("FINISHED"))
                .andExpect(jsonPath("$.fechaFinalizacion").isString());
    }
}
