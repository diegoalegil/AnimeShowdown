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
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EmailVerificationRepository;
import com.diegoalegil.animeshowdown.repository.NotificacionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.NotificacionService;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración de notificaciones in-app.
 *
 * <p>Cubre el flujo REST completo + el trigger BIENVENIDA tras verificar
 * email. Los tests no cubren el push WebSocket en vivo — eso requiere
 * arrancar el broker STOMP y conectar un cliente real; queda como
 * verificación manual en producción.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class NotificacionControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private EmailVerificationRepository emailVerificationRepository;
    @Autowired private NotificacionRepository notificacionRepository;
    @Autowired private NotificacionService notificacionService;

    private record Sesion(String token, Usuario usuario) {}

    /** Registra un usuario, verifica su email y devuelve { jwt, entidad }. */
    private Sesion crearUsuarioVerificado(String username, String email) throws Exception {
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))))
                .andExpect(status().isCreated());
        var usuario = usuarioRepository.findByUsername(username).orElseThrow();
        var verification = emailVerificationRepository.findAll().stream()
                .filter(v -> v.getUsuario().getId().equals(usuario.getId()))
                .findFirst().orElseThrow();
        mvc.perform(get("/api/auth/verify?token=" + verification.getToken()))
                .andExpect(status().isOk());
        var loginRes = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        String jwt = json.readTree(loginRes.getResponse().getContentAsString()).get("token").asText();
        return new Sesion(jwt, usuarioRepository.findByUsername(username).orElseThrow());
    }

    @Test
    void verificarEmailDisparaNotificacionBienvenida() throws Exception {
        Sesion s = crearUsuarioVerificado("notif_alice", "notif_alice@example.com");

        var notifs = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(s.usuario().getId()))
                .toList();
        assert notifs.size() == 1 : "Debe haber 1 notif BIENVENIDA tras verificar; size=" + notifs.size();
        assert notifs.get(0).getTipo() == NotificacionTipo.BIENVENIDA;
        assert !notifs.get(0).isLeida() : "La notificación recién creada debe estar no leída";
    }

    @Test
    void listarNotificacionesDevuelveLaPaginaConBienvenida() throws Exception {
        Sesion s = crearUsuarioVerificado("notif_bob", "notif_bob@example.com");

        mvc.perform(get("/api/notificaciones")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].tipo").value("BIENVENIDA"))
                .andExpect(jsonPath("$.content[0].leida").value(false))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void unreadCountReflejaSoloNoLeidas() throws Exception {
        Sesion s = crearUsuarioVerificado("notif_carla", "notif_carla@example.com");

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));

        // Marcamos como leída y el count baja a 0.
        var notif = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(s.usuario().getId()))
                .findFirst().orElseThrow();
        mvc.perform(post("/api/notificaciones/" + notif.getId() + "/leida")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk());

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void noPuedoMarcarNotificacionDeOtroUsuario() throws Exception {
        Sesion dueno = crearUsuarioVerificado("notif_owner", "notif_owner@example.com");
        Sesion atacante = crearUsuarioVerificado("notif_attacker", "notif_attacker@example.com");

        var notifDueno = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(dueno.usuario().getId()))
                .findFirst().orElseThrow();

        // 404 idéntico a "no existe" — el endpoint no filtra info entre
        // ambos casos para no revelar la existencia de IDs ajenos.
        mvc.perform(post("/api/notificaciones/" + notifDueno.getId() + "/leida")
                .header("Authorization", "Bearer " + atacante.token()))
                .andExpect(status().isNotFound());

        // La notificación del dueño sigue no-leída.
        var refrescada = notificacionRepository.findById(notifDueno.getId()).orElseThrow();
        assert !refrescada.isLeida() : "El atacante no debe haber podido marcar como leída";
    }

    @Test
    void marcarTodasLeidasFunciona() throws Exception {
        Sesion s = crearUsuarioVerificado("notif_diana", "notif_diana@example.com");

        // Creamos algunas notificaciones extra para tener variedad.
        notificacionService.crear(s.usuario(), NotificacionTipo.SISTEMA, "Aviso 1", "msg", null);
        notificacionService.crear(s.usuario(), NotificacionTipo.SISTEMA, "Aviso 2", "msg", null);
        // Tenemos 3 no leídas (1 BIENVENIDA + 2 SISTEMA).

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.count").value(3));

        mvc.perform(post("/api/notificaciones/marcar-todas-leidas")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actualizadas").value(3));

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void soloNoLeidasFiltraCorrectamente() throws Exception {
        Sesion s = crearUsuarioVerificado("notif_eva", "notif_eva@example.com");
        notificacionService.crear(s.usuario(), NotificacionTipo.SISTEMA, "Pendiente", "m", null);

        // 2 totales (BIENVENIDA + SISTEMA), 2 no leídas.
        mvc.perform(get("/api/notificaciones?soloNoLeidas=true")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.totalElements").value(2));

        // Marcamos la BIENVENIDA como leída — soloNoLeidas debe devolver solo 1.
        var bienvenida = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(s.usuario().getId())
                        && n.getTipo() == NotificacionTipo.BIENVENIDA)
                .findFirst().orElseThrow();
        mvc.perform(post("/api/notificaciones/" + bienvenida.getId() + "/leida")
                .header("Authorization", "Bearer " + s.token()));

        mvc.perform(get("/api/notificaciones?soloNoLeidas=true")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].tipo").value("SISTEMA"));

        // Sin filtro siguen siendo 2.
        mvc.perform(get("/api/notificaciones")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void sinAuthEsRechazado() throws Exception {
        // Spring Security con anyRequest().authenticated() + sin
        // authenticationEntryPoint custom devuelve 403 Forbidden cuando
        // falta auth en un endpoint protegido. No es 401 — esa diferencia
        // se controla con un AuthenticationEntryPoint explícito (TODO si
        // queremos pulir el contrato HTTP en el bloque 16).
        mvc.perform(get("/api/notificaciones"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/notificaciones/unread-count"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/notificaciones/marcar-todas-leidas"))
                .andExpect(status().isForbidden());
    }
}
