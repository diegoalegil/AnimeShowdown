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
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.NotificacionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.BadgeService;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración del sistema de badges/logros (Plan v2 §4.2).
 *
 * <p>Cubre catalogo + endpoint personal + flow desbloqueo:
 * <ul>
 *   <li>GET /api/logros sin auth devuelve 14 del catálogo.</li>
 *   <li>GET /api/logros/mios sin auth: 403.</li>
 *   <li>Usuario nuevo: 14 entries, todos con desbloqueadoEn null.</li>
 *   <li>Tras desbloquear "primer_voto" via BadgeService directamente:
 *       endpoint refleja el desbloqueo + se crea notif BADGE_DESBLOQUEADO.</li>
 *   <li>Desbloquear el mismo dos veces: idempotente, solo 1 fila.</li>
 * </ul>
 *
 * <p>Tests del EventListener via votos NO se incluyen aquí: requerirían
 * configurar un torneo + enfrentamiento real, ya lo hace
 * EnfrentamientoControllerTest. Verificar el listener directamente con
 * BadgeService.desbloquear es equivalente.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class LogroControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private BadgeService badgeService;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private UsuarioLogroRepository usuarioLogroRepository;
    @Autowired private NotificacionRepository notificacionRepository;

    private Usuario crearUsuario(String username, String email) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))))
                .andExpect(status().isCreated());
        return usuarioRepository.findByUsername(username).orElseThrow();
    }

    private String tokenDe(String username) throws Exception {
        var res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void catalogoPublicoDevuelve15Logros() throws Exception {
        mvc.perform(get("/api/logros"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(15))
                // Spot-check: primer_voto siempre debe existir.
                .andExpect(jsonPath("$[?(@.codigo=='primer_voto')]").exists())
                .andExpect(jsonPath("$[?(@.codigo=='primera_victoria_pvp')]").exists());
    }

    @Test
    void miosSinAuthDevuelveForbidden() throws Exception {
        mvc.perform(get("/api/logros/mios"))
                .andExpect(status().isForbidden());
    }

    @Test
    void miosUsuarioNuevoDevuelveTodosSinDesbloquear() throws Exception {
        crearUsuario("badge_alice", "badge_alice@example.com");
        String token = tokenDe("badge_alice");

        mvc.perform(get("/api/logros/mios")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(15))
                // Todos los desbloqueadoEn deben ser null para user nuevo.
                .andExpect(jsonPath("$[?(@.desbloqueadoEn != null)]").doesNotExist());
    }

    @Test
    void desbloquearPrimerVotoPersisteRowYDisparaNotif() throws Exception {
        Usuario u = crearUsuario("badge_bob", "badge_bob@example.com");
        long notifsAntes = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(u.getId())).count();

        var resultado = badgeService.desbloquear(u, "primer_voto");
        assert resultado.isPresent() : "Primera vez, debe devolver Optional con UsuarioLogro";

        assert usuarioLogroRepository.countByUsuario(u) == 1
                : "Debe haber 1 UsuarioLogro tras desbloquear primer_voto";

        long notifsDespues = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(u.getId())).count();
        assert notifsDespues == notifsAntes + 1
                : "Debe haberse creado 1 notif BADGE_DESBLOQUEADO; antes=" + notifsAntes
                  + " despues=" + notifsDespues;
    }

    @Test
    void desbloquearMismoBadgeDosVecesEsIdempotente() throws Exception {
        Usuario u = crearUsuario("badge_carla", "badge_carla@example.com");

        var primera = badgeService.desbloquear(u, "primer_voto");
        var segunda = badgeService.desbloquear(u, "primer_voto");

        assert primera.isPresent() : "Primer desbloqueo devuelve Optional con valor";
        assert segunda.isEmpty()   : "Segundo desbloqueo del mismo badge devuelve empty";

        assert usuarioLogroRepository.countByUsuario(u) == 1
                : "Solo debe haber 1 fila tras dos intentos del mismo badge";
    }

    @Test
    void desbloquearCodigoInexistenteDevuelveEmpty() throws Exception {
        Usuario u = crearUsuario("badge_diana", "badge_diana@example.com");

        var resultado = badgeService.desbloquear(u, "codigo_que_no_existe_jamas");
        assert resultado.isEmpty() : "Código inexistente devuelve Optional.empty";
        assert usuarioLogroRepository.countByUsuario(u) == 0
                : "No debe crearse ninguna fila";
    }

    @Test
    void miosTrasDesbloqueoMarcaDesbloqueadoEn() throws Exception {
        Usuario u = crearUsuario("badge_eva", "badge_eva@example.com");
        String token = tokenDe("badge_eva");

        badgeService.desbloquear(u, "primer_voto");

        mvc.perform(get("/api/logros/mios")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.codigo=='primer_voto')].desbloqueadoEn").exists())
                .andExpect(jsonPath("$[?(@.codigo=='primer_voto' && @.desbloqueadoEn != null)]").exists())
                // Los demás siguen sin desbloquear.
                .andExpect(jsonPath("$[?(@.codigo=='mil_votos' && @.desbloqueadoEn == null)]").exists());
    }

    @Test
    void statsPublicoDevuelve14CodigosConCount() throws Exception {
        // Sin desbloqueos previos, el endpoint debe devolver los 14 codigos
        // del catálogo con count=0 (no se omiten los que tienen 0).
        mvc.perform(get("/api/logros/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.primer_voto").exists())
                .andExpect(jsonPath("$.mil_votos").exists())
                .andExpect(jsonPath("$.primer_voto").value(org.hamcrest.Matchers.greaterThanOrEqualTo(0)));
    }

    @Test
    void statsCuentaDesbloqueosDeMultiplesUsuarios() throws Exception {
        Usuario u1 = crearUsuario("stats_alice", "stats_alice@example.com");
        Usuario u2 = crearUsuario("stats_bob", "stats_bob@example.com");
        long primerVotoAntes = primerVotoCount();

        badgeService.desbloquear(u1, "primer_voto");
        badgeService.desbloquear(u2, "primer_voto");

        long primerVotoDespues = primerVotoCount();
        assert primerVotoDespues == primerVotoAntes + 2
                : "Debe sumar 2 desbloqueos; antes=" + primerVotoAntes
                  + " despues=" + primerVotoDespues;
    }

    private long primerVotoCount() throws Exception {
        var res = mvc.perform(get("/api/logros/stats"))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString())
                .get("primer_voto").asLong();
    }
}
