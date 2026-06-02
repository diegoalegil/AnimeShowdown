package com.diegoalegil.animeshowdown.controller;

import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.TestAsyncConfig;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.PushSubscription;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EmailVerificationRepository;
import com.diegoalegil.animeshowdown.repository.NotificacionRepository;
import com.diegoalegil.animeshowdown.repository.PushSubscriptionRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.NotificacionService;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración de notificaciones in-app.
 *
 * <p>Cubre el flujo REST completo + los triggers de Fundador y BIENVENIDA.
 * Los tests no cubren el push WebSocket en vivo — eso requiere
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
    @MockitoSpyBean private NotificacionRepository notificacionRepository;
    @Autowired private PushSubscriptionRepository pushSubscriptionRepository;
    @Autowired private TorneoRepository torneoRepository;
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
        long bienvenida = notifs.stream()
                .filter(n -> n.getTipo() == NotificacionTipo.BIENVENIDA)
                .count();
        long fundador = notifs.stream()
                .filter(n -> n.getTipo() == NotificacionTipo.BADGE_DESBLOQUEADO
                        && n.getPayload() != null
                        && n.getPayload().contains("\"codigo\":\"fundador\""))
                .count();
        assert bienvenida == 1 : "Debe haber 1 notif BIENVENIDA tras verificar; size=" + notifs.size();
        assert fundador == 1 : "Debe haber 1 notif BADGE_DESBLOQUEADO de Fundador; size=" + notifs.size();
        assert notifs.stream().allMatch(n -> !n.isLeida())
                : "Las notificaciones recién creadas deben estar no leídas";
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
                .andExpect(jsonPath("$.content[?(@.tipo=='BADGE_DESBLOQUEADO')]").exists())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void unreadCountReflejaSoloNoLeidas() throws Exception {
        Sesion s = crearUsuarioVerificado("notif_carla", "notif_carla@example.com");

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2));

        // Marcamos una como leída y el count baja a 1.
        var notif = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(s.usuario().getId()))
                .findFirst().orElseThrow();
        mvc.perform(post("/api/notificaciones/" + notif.getId() + "/leida")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk());

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));
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
        // Tenemos 4 no leídas (Fundador + BIENVENIDA + 2 SISTEMA).

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.count").value(4));

        mvc.perform(post("/api/notificaciones/marcar-todas-leidas")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actualizadas").value(4));

        mvc.perform(get("/api/notificaciones/unread-count")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void soloNoLeidasFiltraCorrectamente() throws Exception {
        Sesion s = crearUsuarioVerificado("notif_eva", "notif_eva@example.com");
        notificacionService.crear(s.usuario(), NotificacionTipo.SISTEMA, "Pendiente", "m", null);

        // 3 totales (Fundador + BIENVENIDA + SISTEMA), 3 no leídas.
        mvc.perform(get("/api/notificaciones?soloNoLeidas=true")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.totalElements").value(3));

        // Marcamos la BIENVENIDA como leída; quedan Fundador + SISTEMA.
        var bienvenida = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(s.usuario().getId())
                        && n.getTipo() == NotificacionTipo.BIENVENIDA)
                .findFirst().orElseThrow();
        mvc.perform(post("/api/notificaciones/" + bienvenida.getId() + "/leida")
                .header("Authorization", "Bearer " + s.token()));

        mvc.perform(get("/api/notificaciones?soloNoLeidas=true")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[?(@.tipo=='SISTEMA')]").exists())
                .andExpect(jsonPath("$.content[?(@.tipo=='BADGE_DESBLOQUEADO')]").exists());

        // Sin filtro siguen siendo 3.
        mvc.perform(get("/api/notificaciones")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void sinAuthEsRechazado() throws Exception {
        // Spring Security con anyRequest().authenticated() + sin
        // authenticationEntryPoint custom devuelve 403 Forbidden cuando
        // falta auth en un endpoint protegido. No es 401 — esa diferencia
        // se controla con un AuthenticationEntryPoint explícito si más adelante
        // queremos pulir el contrato HTTP.
        mvc.perform(get("/api/notificaciones"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/notificaciones/unread-count"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/notificaciones/marcar-todas-leidas"))
                .andExpect(status().isForbidden());
    }

    @Test
    void pushSubscribeYUnsubscribePersistenEndpointDelUsuario() throws Exception {
        Sesion s = crearUsuarioVerificado("push_alice", "push_alice@example.com");

        mvc.perform(get("/api/me/push/public-key")
                .header("Authorization", "Bearer " + s.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.publicKey").value(""));

        String endpoint = "https://fcm.googleapis.com/fcm/send/alice";
        mvc.perform(post("/api/me/push/subscribe")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "endpoint", endpoint,
                        "keys", Map.of("p256dh", "key-alice-0123456789", "auth", "auth-alice-012345")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.endpoint").value(endpoint));

        var guardada = pushSubscriptionRepository.findByEndpoint(endpoint).orElseThrow();
        assert guardada.getUsuario().getId().equals(s.usuario().getId());

        mvc.perform(delete("/api/me/push/unsubscribe")
                .header("Authorization", "Bearer " + s.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("endpoint", endpoint))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eliminadas").value(1));

        assert pushSubscriptionRepository.findByEndpoint(endpoint).isEmpty();
    }

    @Test
    void fanOutPushEsIdempotentePorEvento() throws Exception {
        Sesion s = crearUsuarioVerificado("push_bob", "push_bob@example.com");
        pushSubscriptionRepository.save(new PushSubscription(
                s.usuario(), "https://fcm.googleapis.com/fcm/send/bob", "key-bob-0123456789", "auth-bob-012345"));
        Torneo torneo = new Torneo("push-copa", "Push Copa", "Torneo con push");
        torneo.setEstado(EstadoTorneo.IN_PROGRESS);
        torneo.setPublico(true);
        torneo = torneoRepository.save(torneo);
        Long torneoId = torneo.getId();

        int primera = notificacionService.notificarTorneoDisponibleATodos(torneo);
        int segunda = notificacionService.notificarTorneoDisponibleATodos(torneo);

        assert primera >= 1 : "Debe crear al menos la notificacion push del usuario del test";
        assert segunda == 0 : "Idempotencia: no repite el mismo evento";
        long total = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(s.usuario().getId()))
                .filter(n -> n.getTipo() == NotificacionTipo.TORNEO_INICIADO)
                .filter(n -> n.getEventoKey() != null && n.getEventoKey().contains("\"torneoId\":" + torneoId))
                .count();
        assert total == 1 : "Debe existir solo una notificacion TORNEO_INICIADO para el evento";

        Torneo otro = new Torneo("push-copa-2", "Push Copa 2", "Otro torneo con push");
        otro.setEstado(EstadoTorneo.IN_PROGRESS);
        otro.setPublico(true);
        otro = torneoRepository.save(otro);
        Long otroId = otro.getId();

        int tercera = notificacionService.notificarTorneoDisponibleATodos(otro);
        assert tercera >= 1 : "Otro torneo el mismo dia debe crear su propia notificacion";
        long totalOtro = notificacionRepository.findAll().stream()
                .filter(n -> n.getUsuario().getId().equals(s.usuario().getId()))
                .filter(n -> n.getTipo() == NotificacionTipo.TORNEO_INICIADO)
                .filter(n -> n.getEventoKey() != null && n.getEventoKey().contains("\"torneoId\":" + otroId))
                .count();
        assert totalOtro == 1 : "Debe existir una notificacion independiente para el segundo evento";
    }

    @Test
    void fanOutPushConcurrenteNoDuplicaEvento() throws Exception {
        // Aislamiento: otros tests de esta clase dejan suscripciones push activas
        // (p. ej. fanOutPushEsIdempotentePorEvento). El fan-out recorre TODAS las
        // suscripciones; si no limpiamos, la suma de creadas deja de ser 1.
        pushSubscriptionRepository.deleteAll();

        Sesion s = crearUsuarioVerificado("push_race", "push_race@example.com");
        pushSubscriptionRepository.save(new PushSubscription(
                s.usuario(), "https://fcm.googleapis.com/fcm/send/race", "key-r", "auth-r"));
        Torneo torneo = new Torneo("push-race-copa", "Push Race Copa", "Torneo con push");
        torneo.setEstado(EstadoTorneo.IN_PROGRESS);
        torneo.setPublico(true);
        torneo = torneoRepository.save(torneo);

        Torneo torneoFinal = torneo;
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> primera = executor.submit(
                    () -> notificacionService.notificarTorneoDisponibleATodos(torneoFinal));
            Future<Integer> segunda = executor.submit(
                    () -> notificacionService.notificarTorneoDisponibleATodos(torneoFinal));
            List<Integer> creadas = List.of(
                    primera.get(10, TimeUnit.SECONDS),
                    segunda.get(10, TimeUnit.SECONDS));

            assert creadas.stream().mapToInt(Integer::intValue).sum() == 1
                    : "Dos fan-outs concurrentes del mismo evento deben crear solo una notificacion";
            long total = notificacionRepository.findAll().stream()
                    .filter(n -> n.getUsuario().getId().equals(s.usuario().getId()))
                    .filter(n -> n.getTipo() == NotificacionTipo.TORNEO_INICIADO)
                    .filter(n -> n.getEventoKey() != null
                            && n.getEventoKey().contains("\"torneoId\":" + torneoFinal.getId()))
                    .count();
            assert total == 1 : "Debe persistirse una sola notificacion para el evento";
        } finally {
            executor.shutdownNow();
            reset(notificacionRepository);
        }
    }
}
