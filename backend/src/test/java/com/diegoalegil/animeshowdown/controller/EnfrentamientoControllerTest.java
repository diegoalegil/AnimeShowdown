package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.dto.BracketUpdateEvent;
import com.diegoalegil.animeshowdown.dto.RankingDeltaEvent;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.security.AnonymousIdentityService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.Cookie;

/**
 * Tests del flujo completo de votación en enfrentamientos:
 *  1. ADMIN crea torneo + lo inicia.
 *  2. ADMIN crea enfrentamiento entre dos personajes existentes (DataSeeder cargó 125).
 *  3. USER autenticado vota → 200, segundo voto duplicado → 409.
 *  4. Voto invitado, en torneo no ACTIVO, o con personaje ajeno al enfrentamiento → respectivos errores.
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

    @Autowired
    private com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository usuarioLogroRepository;

    @MockitoSpyBean
    private com.diegoalegil.animeshowdown.repository.VotoRepository votoRepository;

    @Autowired
    private com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository enfrentamientoRepository;

    @Autowired
    private com.diegoalegil.animeshowdown.repository.MadrugadorDiaRepository madrugadorDiaRepository;

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AnonymousIdentityService anonymousIdentityService;

    @MockitoBean
    private SimpMessagingTemplate messaging;

    @Autowired
    private MutableTestClock clock;

    @Autowired
    @Qualifier("taskExecutor")
    private Executor taskExecutor;

    @Autowired
    private com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository personajeVotoScoreRepository;

    @Autowired
    private org.springframework.transaction.support.TransactionTemplate tx;

    @BeforeEach
    void fijarClockUtcPorDefecto() throws Exception {
        esperarAsyncDefaultIdle();
        madrugadorDiaRepository.deleteAll();
        // Aísla el throttle anti-fraude entre tests. El anon_ip_hash ahora
        // es IP-real + User-Agent (ya no incluye la sesión), así que todos
        // los votos anónimos del suite (mismo 127.0.0.1, reloj congelado)
        // caen en el MISMO bucket; sin esta limpieza se acumularían en la
        // ventana de 1h y dispararían el captcha en tests posteriores.
        votoRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM voto_torneo_stats");
        jdbcTemplate.update("DELETE FROM voto_enfrentamiento_stats");
        jdbcTemplate.update("DELETE FROM voto_personaje_dia_stats");
        jdbcTemplate.update("DELETE FROM voto_personaje_stats");
        var rankingCache = cacheManager.getCache("votos-ranking");
        if (rankingCache != null) {
            rankingCache.clear();
        }
        fijarClock("2026-05-22T06:42:00Z");
    }

    @AfterEach
    void esperarListenersAsync() throws Exception {
        esperarAsyncDefaultIdle();
    }

    private void fijarClock(String instantIso) {
        clock.setInstant(Instant.parse(instantIso));
    }

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
        // Tras revisión, la promoción a ADMIN ya no ocurre en registro;
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
        MvcResult res = mvc.perform(get("/api/personajes/catalogo")
                        .param("fields", "id,slug"))
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
    @Test
    void siguientesDevuelveLoteHidratadoDistintoYRespetaExcludeIds() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "lote-1");
        crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "lote-2");

        MvcResult res = mvc.perform(get("/api/enfrentamientos/siguientes?count=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                // Hidratación de ambos personajes en la misma respuesta (sin N+1).
                .andExpect(jsonPath("$[0].personaje1.slug").exists())
                .andExpect(jsonPath("$[0].personaje2.slug").exists())
                .andReturn();

        var arr = json.readTree(res.getResponse().getContentAsString());
        org.junit.jupiter.api.Assertions.assertTrue(arr.size() >= 1 && arr.size() <= 5,
                "el lote respeta el cap count");
        Set<Long> vistos = new java.util.HashSet<>();
        for (var node : arr) {
            org.junit.jupiter.api.Assertions.assertTrue(vistos.add(node.get("id").asLong()),
                    "los enfrentamientos del lote deben ser distintos");
        }
        long alguno = arr.get(0).get("id").asLong();

        // excludeIds excluye el id pedido (mismo contrato que /siguiente).
        mvc.perform(get("/api/enfrentamientos/siguientes?count=10&excludeIds=" + alguno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + alguno + ")]").doesNotExist());
    }

    private long crearEnfrentamientoListoParaVotar(String adminToken, long p1, long p2, String suffix) throws Exception {
        return crearFixtureListoParaVotar(adminToken, p1, p2, suffix).enfrentamientoId();
    }

    private MatchFixture crearFixtureListoParaVotar(String adminToken, long p1, long p2, String suffix) throws Exception {
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
        String slug = json.readTree(resTorneo.getResponse().getContentAsString()).get("slug").asText();

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
        long enfrentamientoId = json.readTree(resEnf.getResponse().getContentAsString()).get(0).get("id").asLong();
        return new MatchFixture(torneoId, slug, enfrentamientoId);
    }

    private record MatchFixture(long torneoId, String slug, long enfrentamientoId) {}

    private MockHttpServletRequestBuilder conAnonCookie(
            MockHttpServletRequestBuilder request,
            Cookie cookie) {
        return cookie == null ? request : request.cookie(cookie);
    }

    private Cookie anonCookieDesde(MvcResult result) {
        String setCookie = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        org.junit.jupiter.api.Assertions.assertNotNull(setCookie,
                "El voto anónimo inicial debe emitir cookie firmada");
        String prefix = anonymousIdentityService.getCookieName() + "=";
        String value = Arrays.stream(setCookie.split(";"))
                .map(String::trim)
                .filter(part -> part.startsWith(prefix))
                .map(part -> part.substring(prefix.length()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Set-Cookie no contiene "
                        + anonymousIdentityService.getCookieName() + ": " + setCookie));
        Cookie cookie = new Cookie(anonymousIdentityService.getCookieName(), value);
        cookie.setPath("/");
        return cookie;
    }

    private String anonSessionDesde(Cookie cookie) {
        return anonymousIdentityService.verify(cookie.getValue())
                .orElseThrow(() -> new AssertionError("Cookie anónima firmada inválida"));
    }

    /**
     * Hot path: la materialización del score de personaje (V53) salió de la
     * transacción del POST /votar a un listener @Async (AFTER_COMMIT) con
     * incremento atómico. Por tanto el POST ya no retiene el lock de la fila de
     * score del personaje y NO debe bloquearse aunque otro proceso la tenga
     * tomada.
     */
    @Test
    void elPostDeVotoNoSeBloqueaPorElLockDeScoreDelPersonajeRetenido() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "hotrow");
        String token = tokenUserRegistrado("hotrow_voter", "hotrow_voter@example.com");
        tx.executeWithoutResult(s -> personajeVotoScoreRepository.insertarSiFalta(ids[0]));

        CountDownLatch lockTomado = new CountDownLatch(1);
        CountDownLatch liberar = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> tenedor = pool.submit(() -> {
                tx.executeWithoutResult(s -> {
                    personajeVotoScoreRepository.incrementarScore(ids[0], 0.0d);
                    lockTomado.countDown();
                    try {
                        liberar.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                });
                return null;
            });
            org.junit.jupiter.api.Assertions.assertTrue(
                    lockTomado.await(5, TimeUnit.SECONDS), "El hilo A no tomó el lock de la fila de score");

            Future<Integer> post = pool.submit(() -> mvc.perform(
                    post("/api/enfrentamientos/" + enfId + "/votar")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                    .andReturn().getResponse().getStatus());

            int status = post.get(5, TimeUnit.SECONDS);
            org.junit.jupiter.api.Assertions.assertEquals(200, status,
                    "El POST de voto no debe bloquearse por el lock de la fila de score del personaje");
            tenedor.cancel(true);
        } finally {
            liberar.countDown();
            pool.shutdownNow();
        }
        esperarAsyncDefaultIdle();
    }

    @Test
    void votarAnonimoPermiteCincoVotosYSextoDevuelve429() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);
        Cookie anonCookie = null;

        for (int i = 0; i < 5; i++) {
            long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-" + i);
            MvcResult res = mvc.perform(conAnonCookie(post("/api/enfrentamientos/" + enfId + "/votar"), anonCookie)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.anonimo").value(true))
                    .andExpect(jsonPath("$.delta").value(org.hamcrest.Matchers.closeTo(0.3, 0.001)))
                    .andExpect(jsonPath("$.votosAnonimosRestantes").value(4 - i))
                    .andReturn();
            if (anonCookie == null) {
                anonCookie = anonCookieDesde(res);
            }
        }

        long sexto = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-6");
        mvc.perform(conAnonCookie(post("/api/enfrentamientos/" + sexto + "/votar"), anonCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.votosAnonimosRestantes").value(0));

        org.junit.jupiter.api.Assertions.assertEquals(
                5,
                votoRepository.countByAnonSessionId(anonSessionDesde(anonCookie)));
    }

    @Test
    void votarAnonimoIgnoraIdentidadLegacyYEmiteCookieFirmada() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        String legacyId = "anon-legacy-client-id";
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-legacy");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("X-AS-Anonymous-Id", legacyId)
                .cookie(new Cookie("as_anon_vote_id", legacyId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anonimo").value(true))
                .andReturn();

        Cookie signedCookie = anonCookieDesde(res);
        String signedSessionId = anonSessionDesde(signedCookie);
        org.junit.jupiter.api.Assertions.assertNotEquals(legacyId, signedSessionId);
        org.junit.jupiter.api.Assertions.assertEquals(0, votoRepository.countByAnonSessionId(legacyId));
        org.junit.jupiter.api.Assertions.assertEquals(1, votoRepository.countByAnonSessionId(signedSessionId));
    }

    /**
     * R3-1 / SEC-001 (regresión): el anti-fraude de voto anónimo no puede
     * evadirse rotando X-Forwarded-For. Escenario de vote-stuffing real: un
     * atacante pega directo al backend y, por petición, descarta la cookie
     * firmada (para saltarse el tope de 5 votos por sesión) y rota
     * X-Forwarded-For (para intentar saltarse el throttle por IP).
     *
     * <p>ANTES del fix la IP del hash salía de X-Forwarded-For crudo y el
     * hash incluía valores controlados por cliente, así que cada voto caía
     * en un bucket distinto y el throttle por IP NUNCA disparaba (los 11
     * votos pasaban con 200). AHORA el hash es IP-real (ClientIpExtractor) +
     * User-Agent, estable frente a esa rotación, y al superar el umbral
     * soft (10/h) el throttle responde 428 PRECONDITION_REQUIRED.
     */
    @Test
    void votarAnonimoRotandoXForwardedForNoEvadeElThrottlePorIp() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);

        // 11 votos > umbral soft (app.anon-abuse.soft-per-hour=10) desde la
        // MISMA conexión (RemoteAddr 127.0.0.1, mismo User-Agent), sin
        // conservar cookie y rotando X-Forwarded-For en cada petición.
        //
        // Cada voto va a un enfrentamiento DISTINTO a propósito: el throttle por
        // IP cuenta por anon_ip_hash a través de TODOS los enfrentamientos, así
        // que el umbral se cruza igual; pero al no repetir enfrentamiento se
        // elimina la carrera con el dedup por (enfrentamiento, sesión) —cada
        // request sin cookie emite una sesión aleatoria nueva— que volvía este
        // test no determinista (a veces 409 antes del 428).
        List<Integer> estados = new java.util.ArrayList<>();
        for (int i = 0; i < 11; i++) {
            long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "xff-stuffing-" + i);
            int status = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                    .header("X-Forwarded-For", "203.0.113." + i)           // IP spoofeada distinta cada vez
                    .header("User-Agent", "vote-stuffer/1.0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body)))
                    .andReturn()
                    .getResponse()
                    .getStatus();
            estados.add(status);
        }

        // El primer voto entra (sanity); y pese a rotar X-Forwarded-For el
        // throttle por IP termina disparando captcha (428). Antes del fix
        // NINGÚN estado era 428 y el stuffing pasaba sin fricción.
        org.junit.jupiter.api.Assertions.assertEquals(
                200, estados.get(0), "El primer voto anónimo debería entrar; estados=" + estados);
        org.junit.jupiter.api.Assertions.assertTrue(
                estados.contains(428),
                "El throttle por IP debe disparar REQUIRE_CAPTCHA (428) pese a rotar "
                        + "X-Forwarded-For; estados observados=" + estados);
    }

    /**
     * el constraint DB
     * uk_voto_enfrentamiento_anon_session debe rechazar el segundo voto
     * con la misma combinación (enfrentamiento_id, anon_session_id)
     * incluso si el check de aplicación se saltara (carrera concurrente,
     * por ejemplo). El controller mapea ese caso al 409 desde el check
     * existsByEnfrentamientoAndAnonSessionId, así que verificamos que
     * efectivamente devuelve 409 (no 500 por DataIntegrityViolation que
     * indicaría que el constraint se disparó sin ser mapeado, o no 200
     * que indicaría duplicado registrado).
     */
    @Test
    void votarAnonimoDosVecesElMismoMatchDevuelve409YNoDuplica() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-dup");
        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);

        // Primer voto OK
        MvcResult primerVoto = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anonimo").value(true))
                .andReturn();
        Cookie anonCookie = anonCookieDesde(primerVoto);

        // Segundo voto MISMA sesión + MISMO match: 409 Conflict.
        // El check de aplicación lo intercepta antes de llegar al constraint.
        mvc.perform(conAnonCookie(post("/api/enfrentamientos/" + enfId + "/votar"), anonCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isConflict());

        // Solo un voto debe quedar en la BBDD, no dos.
        org.junit.jupiter.api.Assertions.assertEquals(
                1,
                votoRepository.countByAnonSessionId(anonSessionDesde(anonCookie)),
                "El constraint uk_voto_enfrentamiento_anon_session debería garantizar"
                        + " un único voto anónimo por sesión y match");
    }

    /**
     * el ranking debía ponderar votos
     * según voto.peso (0.30 anónimo, 1.00 registrado). Antes COUNT(v)
     * trataba a los anónimos como registrados, alterando el orden.
     *
     * Escenario:
     *   - Personaje A recibe 1 voto registrado (peso 1.0).
     *   - Personaje B recibe 3 votos anónimos (peso 0.30 × 3 = 0.9).
     * Con COUNT: B (3) > A (1) → orden incorrecto.
     * Con SUM(peso): A (1.0) > B (0.9) → orden correcto.
     */
    @Test
    void rankingPonderaVotosAnonimosConPeso030() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        long persoA = ids[0]; // recibe 1 registrado
        long persoB = ids[1]; // recibe 3 anónimos

        // El catálogo persiste entre tests del mismo @SpringBootTest; otros
        // tests pueden haber dejado votos en luffy/zoro. En vez de borrar
        // (lo cual requiere @Transactional explícita y arrastra problemas),
        // tomamos snapshot del peso pre-test y verificamos solo el DELTA
        // exacto. Así el test es robusto al orden de ejecución.
        Double pesoAntesA = votoRepository.sumaPesoByPersonajeId(persoA);
        Double pesoAntesB = votoRepository.sumaPesoByPersonajeId(persoB);
        double votosAntesA = votoRepository.countByPersonajeId(persoA);
        double votosAntesB = votoRepository.countByPersonajeId(persoB);

        // 1 voto registrado a A (incrementa peso en 1.0, votos en 1)
        String userTok = tokenUserRegistrado("ranking_peso_user", "rankingpeso@example.com");
        long enfA = crearEnfrentamientoListoParaVotar(adminToken, persoA, persoB, "peso-A");
        mvc.perform(post("/api/enfrentamientos/" + enfA + "/votar")
                .header("Authorization", "Bearer " + userTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", persoA))))
                .andExpect(status().isOk());

        // 3 votos anónimos a B desde tres sesiones distintas (constraint
        // uk_voto_enfrentamiento_anon_session los rechazaría si fueran
        // el mismo match + sesión). Cada uno incrementa peso en 0.30
        // y votos en 1 → total +0.90 y +3.
        for (int i = 0; i < 3; i++) {
            long enfB = crearEnfrentamientoListoParaVotar(adminToken, persoA, persoB, "peso-B" + i);
            mvc.perform(post("/api/enfrentamientos/" + enfB + "/votar")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("personajeGanadorId", persoB))))
                    .andExpect(status().isOk());
        }

        MvcResult res = mvc.perform(get("/api/votos/ranking"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = json.readTree(res.getResponse().getContentAsString());

        // Buscamos entries de A y B en el ranking devuelto.
        JsonNode entryA = null, entryB = null;
        for (int i = 0; i < arr.size(); i++) {
            long pid = arr.get(i).get("personaje").get("id").asLong();
            if (pid == persoA) entryA = arr.get(i);
            if (pid == persoB) entryB = arr.get(i);
        }
        org.junit.jupiter.api.Assertions.assertNotNull(entryA, "Personaje A no aparece en ranking");
        org.junit.jupiter.api.Assertions.assertNotNull(entryB, "Personaje B no aparece en ranking");

        // deltas exactos.
        // - votos físicos: A +1, B +3 (no truncado por el peso).
        // - pesoVotos: A +1.0, B +0.9 (3 anónimos × 0.30).
        // Antes de ponderar por peso ambos contaban igual (+1 cada uno), así
        // que B siempre vencía a A — bug de ranking falseado.
        double deltaVotosA = entryA.get("votos").asDouble() - votosAntesA;
        double deltaVotosB = entryB.get("votos").asDouble() - votosAntesB;
        double deltaPesoA = entryA.get("pesoVotos").asDouble() - pesoAntesA;
        double deltaPesoB = entryB.get("pesoVotos").asDouble() - pesoAntesB;

        org.junit.jupiter.api.Assertions.assertEquals(1.0, deltaVotosA, 0.001,
                "Delta votos físicos de A debe ser exactamente +1");
        org.junit.jupiter.api.Assertions.assertEquals(3.0, deltaVotosB, 0.001,
                "Delta votos físicos de B debe ser exactamente +3");
        org.junit.jupiter.api.Assertions.assertEquals(1.0, deltaPesoA, 0.001,
                "Delta peso de A debe ser +1.0 (voto registrado)");
        org.junit.jupiter.api.Assertions.assertEquals(0.9, deltaPesoB, 0.001,
                "Delta peso de B debe ser +0.9 (3 anónimos × 0.30)");
    }

    @Test
    void migrarVotosAnonimosAsociaHistorialAlLogin() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        String anonToken = anonymousIdentityService.emit();
        Cookie anonCookie = new Cookie(anonymousIdentityService.getCookieName(), anonToken);
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-migrate");

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .cookie(anonCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anonimo").value(true));

        String token = tokenUserRegistrado("anon_migrate_user", "anon-migrate@example.com");
        mvc.perform(post("/api/perfil/me/migrar-votos-anonimos")
                .header("Authorization", "Bearer " + token)
                .cookie(anonCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.migrados").value(1));

        mvc.perform(get("/api/perfil/me/historial-votos")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].personajeId").value(ids[0]));
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
    void votarEmpateNeutralSumaMedioACadaPersonajeYPublicaDosDeltas() throws Exception {
        reset(messaging);
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_empate_user", "votoempate@example.com");
        long[] ids = dosPersonajes();
        double votosAntesA = votoRepository.countByPersonajeId(ids[0]);
        double votosAntesB = votoRepository.countByPersonajeId(ids[1]);
        Double pesoAntesA = votoRepository.sumaPesoByPersonajeId(ids[0]);
        Double pesoAntesB = votoRepository.sumaPesoByPersonajeId(ids[1]);
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "empate-neutral");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("empate", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.empate").value(true))
                .andExpect(jsonPath("$.personajeGanadorId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.personajePerdedorId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.votosGanador").value(0.5))
                .andExpect(jsonPath("$.votosPerdedor").value(0.5))
                .andExpect(jsonPath("$.delta").value(0.0))
                .andReturn();

        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();
        org.junit.jupiter.api.Assertions.assertTrue(votoRepository.findById(votoId).orElseThrow().isEmpate());
        org.junit.jupiter.api.Assertions.assertEquals(votosAntesA + 0.5,
                votoRepository.countByPersonajeId(ids[0]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(votosAntesB + 0.5,
                votoRepository.countByPersonajeId(ids[1]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(pesoAntesA + 0.5,
                votoRepository.sumaPesoByPersonajeId(ids[0]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(pesoAntesB + 0.5,
                votoRepository.sumaPesoByPersonajeId(ids[1]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(0.5,
                votoRepository.scoreByEnfrentamientoAndPersonaje(
                        votoRepository.findById(votoId).orElseThrow().getEnfrentamiento(),
                        votoRepository.findById(votoId).orElseThrow().getEnfrentamiento().getPersonaje1()),
                0.001);
        var captor = org.mockito.ArgumentCaptor.forClass(RankingDeltaEvent.class);
        verify(messaging, times(2)).convertAndSend(eq("/topic/ranking-delta"), captor.capture());
        Set<String> slugs = captor.getAllValues().stream()
                .map(ev -> ev.getPersonaje().getSlug())
                .collect(Collectors.toSet());
        org.junit.jupiter.api.Assertions.assertEquals(Set.of("luffy", "zoro"), slugs);
        captor.getAllValues().forEach(ev -> {
            org.junit.jupiter.api.Assertions.assertEquals(0.5, ev.getDelta(), 0.001);
            org.junit.jupiter.api.Assertions.assertEquals(0.5, ev.getDeltaPeso(), 0.001);
        });
    }

    @Test
    void votarEmpateAnonimoPesa015PorPersonajeYPublicaDeltas() throws Exception {
        reset(messaging);
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        double votosAntesA = votoRepository.countByPersonajeId(ids[0]);
        double votosAntesB = votoRepository.countByPersonajeId(ids[1]);
        Double pesoAntesA = votoRepository.sumaPesoByPersonajeId(ids[0]);
        Double pesoAntesB = votoRepository.sumaPesoByPersonajeId(ids[1]);
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "empate-anon");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("X-AS-Anonymous-Id", "anon-empate-peso")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("empate", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anonimo").value(true))
                .andExpect(jsonPath("$.empate").value(true))
                .andExpect(jsonPath("$.votosGanador").value(0.5))
                .andExpect(jsonPath("$.votosPerdedor").value(0.5))
                .andExpect(jsonPath("$.delta").value(0.0))
                .andReturn();

        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();
        Voto voto = votoRepository.findById(votoId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(0.15, voto.getPeso().doubleValue(), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(votosAntesA + 0.5,
                votoRepository.countByPersonajeId(ids[0]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(votosAntesB + 0.5,
                votoRepository.countByPersonajeId(ids[1]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(pesoAntesA + 0.15,
                votoRepository.sumaPesoByPersonajeId(ids[0]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(pesoAntesB + 0.15,
                votoRepository.sumaPesoByPersonajeId(ids[1]), 0.001);

        var captor = org.mockito.ArgumentCaptor.forClass(RankingDeltaEvent.class);
        verify(messaging, times(2)).convertAndSend(eq("/topic/ranking-delta"), captor.capture());
        captor.getAllValues().forEach(ev -> {
            org.junit.jupiter.api.Assertions.assertEquals(0.5, ev.getDelta(), 0.001);
            org.junit.jupiter.api.Assertions.assertEquals(0.15, ev.getDeltaPeso(), 0.001);
        });
    }

    @Test
    void votarEmpateAnonimoPondera015YPersisteSesionFirmada() throws Exception {
        reset(messaging);
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        double votosAntesA = votoRepository.countByPersonajeId(ids[0]);
        double votosAntesB = votoRepository.countByPersonajeId(ids[1]);
        Double pesoAntesA = votoRepository.sumaPesoByPersonajeId(ids[0]);
        Double pesoAntesB = votoRepository.sumaPesoByPersonajeId(ids[1]);
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "empate-anon");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("empate", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anonimo").value(true))
                .andExpect(jsonPath("$.empate").value(true))
                .andExpect(jsonPath("$.personajeGanadorId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.personajePerdedorId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.votosGanador").value(0.5))
                .andExpect(jsonPath("$.votosPerdedor").value(0.5))
                .andExpect(jsonPath("$.delta").value(0.0))
                .andExpect(jsonPath("$.votosAnonimosRestantes").value(4))
                .andReturn();

        Cookie anonCookie = anonCookieDesde(res);
        String anonSessionId = anonSessionDesde(anonCookie);
        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();
        var voto = votoRepository.findById(votoId).orElseThrow();

        org.junit.jupiter.api.Assertions.assertTrue(voto.isEmpate());
        org.junit.jupiter.api.Assertions.assertNull(voto.getUsuario());
        org.junit.jupiter.api.Assertions.assertEquals(anonSessionId, voto.getAnonSessionId());
        org.junit.jupiter.api.Assertions.assertEquals(0.15, voto.getPeso().doubleValue(), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(1, votoRepository.countByAnonSessionId(anonSessionId));
        org.junit.jupiter.api.Assertions.assertEquals(votosAntesA + 0.5,
                votoRepository.countByPersonajeId(ids[0]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(votosAntesB + 0.5,
                votoRepository.countByPersonajeId(ids[1]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(pesoAntesA + 0.15,
                votoRepository.sumaPesoByPersonajeId(ids[0]), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(pesoAntesB + 0.15,
                votoRepository.sumaPesoByPersonajeId(ids[1]), 0.001);

        var captor = org.mockito.ArgumentCaptor.forClass(RankingDeltaEvent.class);
        verify(messaging, times(2)).convertAndSend(eq("/topic/ranking-delta"), captor.capture());
        Set<String> slugs = captor.getAllValues().stream()
                .map(ev -> ev.getPersonaje().getSlug())
                .collect(Collectors.toSet());
        org.junit.jupiter.api.Assertions.assertEquals(Set.of("luffy", "zoro"), slugs);
        captor.getAllValues().forEach(ev -> {
            org.junit.jupiter.api.Assertions.assertEquals(0.5, ev.getDelta(), 0.001);
            org.junit.jupiter.api.Assertions.assertEquals(0.15, ev.getDeltaPeso(), 0.001);
        });
    }

    /**
     * El voto NO hace @CacheEvict del ranking (se quitó el evict por-voto que
     * causaba estampida bajo carga). El endpoint REST /api/votos/ranking es
     * eventualmente consistente: cacheado por TTL (30s) y puede no reflejar el
     * voto recién emitido dentro de esa ventana. El voto SÍ se persiste de
     * inmediato (la señal en vivo viaja por RankingDeltaEvent — ver
     * votarPublicaDeltaRankingPorWebSocket).
     */
    @Test
    void votarNoEvictaCacheRankingDependeDelTtl() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_cache_user", "votocache@example.com");
        long[] ids = dosPersonajes();

        // Primer GET cachea el ranking SIN ids[0] (aún sin votos).
        mvc.perform(get("/api/votos/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.personaje.id == " + ids[0] + ")]").doesNotExist());

        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "cache-ranking");
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        // El voto se persistió de inmediato (fuente de verdad).
        org.junit.jupiter.api.Assertions.assertEquals(
                1.0, votoRepository.countByPersonajeId(ids[0]), 0.001);

        // Pero el ranking REST sigue sirviendo la versión cacheada (sin evict
        // por-voto): ids[0] todavía no aparece hasta que expire el TTL.
        mvc.perform(get("/api/votos/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.personaje.id == " + ids[0] + ")]").doesNotExist());
    }

    @Test
    void votarPublicaDeltaRankingPorWebSocket() throws Exception {
        reset(messaging);
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_ws_user", "votows@example.com");
        long[] ids = dosPersonajes();
        double antes = votoRepository.countByPersonajeId(ids[0]);
        Double pesoAntes = votoRepository.sumaPesoByPersonajeId(ids[0]);
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "ws");

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var captor = org.mockito.ArgumentCaptor.forClass(RankingDeltaEvent.class);
        verify(messaging).convertAndSend(eq("/topic/ranking-delta"), captor.capture());
        RankingDeltaEvent ev = captor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals("luffy", ev.getPersonaje().getSlug());
        org.junit.jupiter.api.Assertions.assertEquals(antes + 1, ev.getVotos(), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(1, ev.getDelta(), 0.001);
        // el WS publica pesoVotos
        // ponderado y deltaPeso del voto recién registrado. Para un voto
        // registrado (no anónimo) deltaPeso = 1.0; pesoVotos = pesoAntes + 1.
        org.junit.jupiter.api.Assertions.assertEquals(
                pesoAntes + 1.0, ev.getPesoVotos(), 0.001,
                "pesoVotos del WS debe ser el total all-time tras el voto");
        org.junit.jupiter.api.Assertions.assertEquals(
                1.0, ev.getDeltaPeso(), 0.001,
                "deltaPeso del WS debe ser 1.0 para voto registrado");
    }

    /**
     * verifica que voto anónimo publica
     * deltaPeso = 0.30 (no 1.0). Antes el frontend infería incrementoPeso
     * restando pesoVotos absoluto contra el de la caché temporal, lo que
     * contaminaba ventanas mensuales con totales históricos.
     */
    @Test
    void votarAnonimoPublicaDeltaPesoCon030() throws Exception {
        reset(messaging);
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "ws-anon");

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var captor = org.mockito.ArgumentCaptor.forClass(RankingDeltaEvent.class);
        verify(messaging).convertAndSend(eq("/topic/ranking-delta"), captor.capture());
        RankingDeltaEvent ev = captor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals(
                0.30, ev.getDeltaPeso(), 0.001,
                "deltaPeso para voto anónimo debe ser 0.30 (no 1.0)");
        // delta físico sigue siendo 1 — el conteo no se pondera.
        org.junit.jupiter.api.Assertions.assertEquals(1, ev.getDelta());
    }

    @Test
    void votarPublicaUpdateSpectatorPorSlug() throws Exception {
        reset(messaging);
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_spectator_user", "votospectator@example.com");
        long[] ids = dosPersonajes();
        MatchFixture fixture = crearFixtureListoParaVotar(adminToken, ids[0], ids[1], "spectator-ws");

        mvc.perform(post("/api/enfrentamientos/" + fixture.enfrentamientoId() + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var captor = org.mockito.ArgumentCaptor.forClass(BracketUpdateEvent.class);
        verify(messaging).convertAndSend(eq("/topic/tournament/" + fixture.slug()), captor.capture());
        BracketUpdateEvent ev = captor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals(fixture.torneoId(), ev.torneoId());
        org.junit.jupiter.api.Assertions.assertEquals(fixture.enfrentamientoId(), ev.enfrentamientoId());
        org.junit.jupiter.api.Assertions.assertEquals(ids[0], ev.personaje1Id());
        org.junit.jupiter.api.Assertions.assertEquals(1, ev.personaje1Votos());
        org.junit.jupiter.api.Assertions.assertEquals(0, ev.personaje2Votos());
        org.junit.jupiter.api.Assertions.assertEquals(1, ev.totalVotos());
    }

    @Test
    void detalleTorneoExponeCurrentMatchConRelojServidorYVotosPorLado() throws Exception {
        fijarClock("2026-05-22T06:42:00Z");
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_live_detail_user", "votolivedetail@example.com");
        long[] ids = dosPersonajes();
        MatchFixture fixture = crearFixtureListoParaVotar(adminToken, ids[0], ids[1], "spectator-detail");

        mvc.perform(get("/api/torneos/slug/" + fixture.slug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentMatch.id").value(fixture.enfrentamientoId()))
                .andExpect(jsonPath("$.currentMatch.personaje1Votos").value(0))
                .andExpect(jsonPath("$.currentMatch.personaje2Votos").value(0))
                .andExpect(jsonPath("$.liveServerNow").value("2026-05-22T06:42:00"))
                .andExpect(jsonPath("$.liveEndsAt").exists());

        mvc.perform(post("/api/enfrentamientos/" + fixture.enfrentamientoId() + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        mvc.perform(get("/api/torneos/slug/" + fixture.slug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentMatch.totalVotos").value(1))
                .andExpect(jsonPath("$.currentMatch.personaje1Votos").value(1))
                .andExpect(jsonPath("$.currentMatch.personaje2Votos").value(0));
    }

    @Test
    void aleatorioDevuelveMatchAbiertoConDtoCompleto() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();

        crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "aleatorio");

        mvc.perform(get("/api/enfrentamientos/aleatorio"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.ronda").isNumber())
                .andExpect(jsonPath("$.personaje1.id").isNumber())
                .andExpect(jsonPath("$.personaje2.id").isNumber())
                .andExpect(jsonPath("$.ganador").doesNotExist());
    }

    @Test
    void siguienteAutenticadoOmiteEnfrentamientosYaVotadosYRespetaExcludeIds() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("siguiente_auth_user", "siguiente-auth@example.com");
        long[] ids = dosPersonajes();
        long yaVotado = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-auth-1");
        long excluido = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-auth-2");
        // Tercer matchup libre: garantiza que /siguiente siempre tenga un candidato
        // válido aunque el test corra en aislamiento (DB sin matchups de otros tests).
        crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-auth-3");

        mvc.perform(post("/api/enfrentamientos/" + yaVotado + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        // /siguiente elige aleatoriamente entre los matchups abiertos y sólo honra
        // los primeros 100 excludeIds, así que no se puede forzar un id exacto de
        // forma determinista (era flaky en CI por el orden de ejecución). Verificamos
        // el CONTRATO documentado: omite el ya-votado y respeta el excludeId explícito,
        // devolviendo un matchup abierto.
        MvcResult res = mvc.perform(get("/api/enfrentamientos/siguiente")
                .header("Authorization", "Bearer " + userToken)
                .param("excludeIds", String.valueOf(excluido)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.ganador").doesNotExist())
                .andReturn();
        long devuelto = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();
        org.junit.jupiter.api.Assertions.assertNotEquals(yaVotado, devuelto,
                "siguiente no debe devolver un enfrentamiento ya votado por el usuario");
        org.junit.jupiter.api.Assertions.assertNotEquals(excluido, devuelto,
                "siguiente debe respetar el excludeId explícito");
    }

    @Test
    void siguienteAnonimoOmiteEnfrentamientosYaVotadosPorLaMismaSesion() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        long yaVotado = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-anon-1");
        long excluido = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-anon-2");
        // Tercer matchup libre: garantiza candidato para /siguiente en aislamiento.
        crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-anon-3");

        MvcResult voto = mvc.perform(post("/api/enfrentamientos/" + yaVotado + "/votar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andReturn();
        Cookie anonCookie = anonCookieDesde(voto);

        // Mismo contrato que el caso autenticado: omite el ya-votado por la sesión y
        // respeta el excludeId. No se asevera un id exacto por el cap de 100 excludeIds +
        // selección aleatoria del endpoint (eso hacía el test flaky según el orden de CI).
        MvcResult res = mvc.perform(conAnonCookie(get("/api/enfrentamientos/siguiente"), anonCookie)
                .param("excludeIds", String.valueOf(excluido)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.ganador").doesNotExist())
                .andReturn();
        long devuelto = json.readTree(res.getResponse().getContentAsString()).get("id").asLong();
        org.junit.jupiter.api.Assertions.assertNotEquals(yaVotado, devuelto,
                "siguiente no debe devolver un enfrentamiento ya votado por la sesión anónima");
        org.junit.jupiter.api.Assertions.assertNotEquals(excluido, devuelto,
                "siguiente debe respetar el excludeId explícito");
    }

    /**
     * Regresión: BadgeEventListener escucha
     * VotoRegistradoEvent en AFTER_COMMIT con @Async. Si el endpoint /votar
     * no abriera tx, el evento se publicaría fuera de tx y AFTER_COMMIT lo
     * descartaría silenciosamente → primer_voto nunca se desbloquearía. Este
     * test confirma la cadena entera end-to-end:
     *   controller @Transactional → publishEvent → AFTER_COMMIT → @Async listener
     *   → BadgeService.desbloquear → UsuarioLogro persistido en BBDD.
     *
     * <p>Este test NO usa TestAsyncConfig (SyncTaskExecutor)
     * porque la combinación AFTER_COMMIT + @Async + SyncTaskExecutor genera
     * un estado intermedio donde TransactionSynchronizationManager dice
     * tx-active pero el EntityManager JPA no tiene tx iniciada — saveAndFlush
     * lanza TransactionRequiredException. En producción el TaskExecutor real
     * corre en otro hilo (estado limpio) y el @Transactional del service
     * abre tx correctamente, así que aquí replicamos eso usando el executor
     * por defecto + polling con timeout.
     */
    @Test
    void votarDesbloqueaPrimerVotoBadge() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_badge_user", "votobadge@example.com");
        long[] ids = dosPersonajes();

        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "badge");

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var u = usuarioRepository.findByUsername("voto_badge_user").orElseThrow();

        // El @Async usa el TaskExecutor por defecto (otro hilo). Polling hasta
        // 5s — en local tarda ~10–30 ms, generoso para CI lento.
        long deadline = System.currentTimeMillis() + 5_000;
        boolean unlocked = false;
        while (System.currentTimeMillis() < deadline) {
            if (usuarioLogroRepository.existsByUsuarioAndLogroCodigo(u, "primer_voto")) {
                unlocked = true;
                break;
            }
            Thread.sleep(50);
        }
        org.junit.jupiter.api.Assertions.assertTrue(
                unlocked,
                "primer_voto debería desbloquearse al votar, pero el listener "
                        + "no persistió UsuarioLogro en 5s");

        mvc.perform(get("/api/logros/mios")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.codigo=='primer_voto' && @.desbloqueadoEn != null)]")
                        .exists());
    }

    /**
     * Regresión: antes existía un uniqueConstraint global
     * (personaje_id, usuario_id) que rompía el caso legítimo "votar al mismo
     * personaje en dos rondas distintas del bracket" — situación normal cuando
     * un personaje avanza. La V16 lo elimina; este test confirma que dos votos
     * por el mismo personaje en enfrentamientos distintos coexisten OK.
     */
    @Test
    void votarMismoPersonajeEnDosEnfrentamientosDistintosFunciona() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_repeat_user", "votorepeat@example.com");
        long[] ids = dosPersonajes();

        long enf1 = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "rep1");
        long enf2 = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "rep2");

        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);
        mvc.perform(post("/api/enfrentamientos/" + enf1 + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk());

        mvc.perform(post("/api/enfrentamientos/" + enf2 + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    @Test
    void soloPrimerUsuarioDelDiaDesbloqueaMadrugadorDelPersonaje() throws Exception {
        String adminToken = tokenAdmin();
        String tokenA = tokenUserRegistrado("madrugador_a", "madrugador-a@example.com");
        String tokenB = tokenUserRegistrado("madrugador_b", "madrugador-b@example.com");
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "madrugador");
        long enfIdB = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "madrugador-b");
        LocalDate fecha = LocalDate.of(2026, 5, 22);

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var userA = usuarioRepository.findByUsername("madrugador_a").orElseThrow();
        var userB = usuarioRepository.findByUsername("madrugador_b").orElseThrow();
        esperarMadrugador("luffy", fecha, userA.getId());

        mvc.perform(post("/api/enfrentamientos/" + enfIdB + "/votar")
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        org.junit.jupiter.api.Assertions.assertEquals(
                1,
                madrugadorDiaRepository.countByPersonajeSlugAndFecha("luffy", fecha));
        org.junit.jupiter.api.Assertions.assertTrue(tieneBadge(userA, "madrugador_luffy"));
        esperarSinBadge(userB, "madrugador_luffy");
    }

    @Test
    void madrugadorSeRecalculaAlCambiarDiaUtc() throws Exception {
        String adminToken = tokenAdmin();
        String tokenA = tokenUserRegistrado("madrugador_day_a", "madrugador-day-a@example.com");
        String tokenB = tokenUserRegistrado("madrugador_day_b", "madrugador-day-b@example.com");
        long[] ids = dosPersonajes();

        LocalDate dia1 = LocalDate.of(2026, 5, 22);
        long enfDia1 = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "madrugador-dia1");
        mvc.perform(post("/api/enfrentamientos/" + enfDia1 + "/votar")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());
        var userA = usuarioRepository.findByUsername("madrugador_day_a").orElseThrow();
        esperarMadrugador("luffy", dia1, userA.getId());

        fijarClock("2026-05-23T00:01:00Z");
        LocalDate dia2 = LocalDate.of(2026, 5, 23);
        long enfDia2 = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "madrugador-dia2");
        mvc.perform(post("/api/enfrentamientos/" + enfDia2 + "/votar")
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());
        var userB = usuarioRepository.findByUsername("madrugador_day_b").orElseThrow();
        esperarMadrugador("luffy", dia2, userB.getId());

        org.junit.jupiter.api.Assertions.assertEquals(
                1,
                madrugadorDiaRepository.countByPrimerUserAndPersonajeSlugAndFecha(userA, "luffy", dia1));
        org.junit.jupiter.api.Assertions.assertEquals(
                1,
                madrugadorDiaRepository.countByPrimerUserAndPersonajeSlugAndFecha(userB, "luffy", dia2));
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
    void elPerdedorDeLaCarreraDeDobleVotoRecibe409SinDuplicar() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_carrera_user", "votocarrera@example.com");
        long[] ids = dosPersonajes();

        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "carrera");

        // El voto previo se inserta directo por repositorio, sin POST: así no
        // dispara los listeners de auto-avance y el match sigue abierto seguro
        // cuando llegue el POST del perdedor de la carrera.
        tx.executeWithoutResult(s -> {
            var enf = enfrentamientoRepository.findById(enfId).orElseThrow();
            var usuario = usuarioRepository.findByUsername("voto_carrera_user").orElseThrow();
            votoRepository.save(new com.diegoalegil.animeshowdown.model.Voto(
                    enf.getPersonaje1(), usuario, enf));
        });
        long votosAntes = votoRepository.count();

        // Simula al perdedor de la carrera: el precheck no ve el voto previo
        // (como cuando dos POSTs simultáneos lo pasan a la vez) y el INSERT
        // pega contra uk_voto_enfrentamiento_usuario. Debe salir el mismo 409
        // que el check aplicativo, nunca un 500 a commit.
        doReturn(false).when(votoRepository).existsByEnfrentamientoAndUsuario(any(), any());

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Ya has votado este enfrentamiento"));

        org.junit.jupiter.api.Assertions.assertEquals(votosAntes, votoRepository.count());
    }

    private void esperarMadrugador(String slug, LocalDate fecha, Long userId) throws Exception {
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            var row = madrugadorDiaRepository.findByPersonajeSlugAndFecha(slug, fecha);
            if (row.isPresent() && row.get().getPrimerUser().getId().equals(userId)) {
                return;
            }
            Thread.sleep(50);
        }
        org.junit.jupiter.api.Assertions.fail("No se registro madrugador para " + slug + " en " + fecha);
    }

    private void esperarAsyncDefaultIdle() throws Exception {
        if (!(taskExecutor instanceof ThreadPoolTaskExecutor executor)) {
            return;
        }
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            boolean noRunningTasks = executor.getActiveCount() == 0;
            boolean noQueuedTasks = executor.getThreadPoolExecutor().getQueue().isEmpty();
            if (noRunningTasks && noQueuedTasks) {
                return;
            }
            Thread.sleep(50);
        }
        org.junit.jupiter.api.Assertions.fail("El executor async no quedó idle en 5s");
    }

    private boolean tieneBadge(com.diegoalegil.animeshowdown.model.Usuario usuario, String codigo) {
        return usuarioLogroRepository.existsByUsuarioAndLogroCodigo(usuario, codigo);
    }


    private void esperarSinBadge(com.diegoalegil.animeshowdown.model.Usuario usuario, String codigo) throws Exception {
        long deadline = System.currentTimeMillis() + 1_000;
        while (System.currentTimeMillis() < deadline) {
            if (tieneBadge(usuario, codigo)) {
                org.junit.jupiter.api.Assertions.fail("El segundo usuario no deberia recibir " + codigo);
            }
            Thread.sleep(50);
        }
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

    // ─── Intención de voto (feature #15) ───────────────────────────────────

    @Test
    void votarConCategoriaPersisteLaIntencion() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_cat_user", "votocat@example.com");
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "cat-ok");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.<String, Object>of(
                        "personajeGanadorId", ids[0], "categoria", "poder"))))
                .andExpect(status().isOk())
                .andReturn();

        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();
        org.junit.jupiter.api.Assertions.assertEquals("poder",
                votoRepository.findById(votoId).orElseThrow().getCategoria());
    }

    @Test
    void votarConCategoriaInvalidaPersisteSinIntencionYDevuelve200() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_cat_bad_user", "votocatbad@example.com");
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "cat-bad");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.<String, Object>of(
                        "personajeGanadorId", ids[0], "categoria", "basura-no-valida"))))
                .andExpect(status().isOk())
                .andReturn();

        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();
        org.junit.jupiter.api.Assertions.assertNull(
                votoRepository.findById(votoId).orElseThrow().getCategoria(),
                "Una categoría inválida no debe perder el voto: se guarda sin intención");
    }

    @Test
    void fijarCategoriaSetOnceFuncionaYSegundaVezDevuelve409() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_patch_user", "votopatch@example.com");
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "patch");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andReturn();
        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();

        // PATCH set-once → 204 y categoría fijada.
        mvc.perform(patch("/api/enfrentamientos/" + enfId + "/votar/categoria")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoria", "carisma"))))
                .andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertEquals("carisma",
                votoRepository.findById(votoId).orElseThrow().getCategoria());

        // Segundo PATCH → 409: set-once, el voto es inmutable.
        mvc.perform(patch("/api/enfrentamientos/" + enfId + "/votar/categoria")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoria", "poder"))))
                .andExpect(status().isConflict());
        org.junit.jupiter.api.Assertions.assertEquals("carisma",
                votoRepository.findById(votoId).orElseThrow().getCategoria(),
                "La categoría no debe cambiar tras el primer set");
    }

    @Test
    void fijarCategoriaConcurrenteSoloAceptaUnaPeticion() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_patch_race_user", "votopatchrace@example.com");
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "patch-race");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andReturn();
        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();

        CountDownLatch lecturasDelCodigoAnterior = new CountDownLatch(2);
        doAnswer(invocation -> {
            Object resultado = invocation.callRealMethod();
            lecturasDelCodigoAnterior.countDown();
            if (!lecturasDelCodigoAnterior.await(5, TimeUnit.SECONDS)) {
                throw new AssertionError("No llegaron los dos PATCH al read previo del voto");
            }
            return resultado;
        }).when(votoRepository).findByEnfrentamientoAndUsuario(any(), any());

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> carisma = executor.submit(() -> patchCategoria(enfId, userToken, "carisma"));
            Future<Integer> poder = executor.submit(() -> patchCategoria(enfId, userToken, "poder"));

            List<Integer> statuses = List.of(
                    carisma.get(10, TimeUnit.SECONDS),
                    poder.get(10, TimeUnit.SECONDS));
            org.junit.jupiter.api.Assertions.assertEquals(1,
                    statuses.stream().filter(status -> status == 204).count(),
                    "Solo un PATCH concurrente debe fijar la intención");
            org.junit.jupiter.api.Assertions.assertEquals(1,
                    statuses.stream().filter(status -> status == 409).count(),
                    "El segundo PATCH concurrente debe observar set-once");

            String categoriaPersistida = votoRepository.findById(votoId).orElseThrow().getCategoria();
            org.junit.jupiter.api.Assertions.assertTrue(
                    Set.of("carisma", "poder").contains(categoriaPersistida),
                    "La intención persistida debe ser una de las dos solicitudes concurrentes");
        } finally {
            executor.shutdownNow();
            reset(votoRepository);
        }
    }

    @Test
    void fijarCategoriaInvalidaEsNoOp204() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_patch_bad_user", "votopatchbad@example.com");
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "patch-bad");

        MvcResult res = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andReturn();
        long votoId = json.readTree(res.getResponse().getContentAsString()).get("votoId").asLong();

        mvc.perform(patch("/api/enfrentamientos/" + enfId + "/votar/categoria")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoria", ""))))
                .andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertNull(
                votoRepository.findById(votoId).orElseThrow().getCategoria(),
                "Categoría blank es no-op: el voto sigue sin intención");
    }

    @Test
    void fijarCategoriaAnonimoFunciona() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "patch-anon");

        MvcResult voto = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andReturn();
        Cookie anonCookie = anonCookieDesde(voto);

        mvc.perform(conAnonCookie(patch("/api/enfrentamientos/" + enfId + "/votar/categoria"), anonCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoria", "favorito"))))
                .andExpect(status().isNoContent());

        var votos = votoRepository.findByAnonSessionIdAndUsuarioIsNullOrderByFechaAsc(
                anonSessionDesde(anonCookie));
        org.junit.jupiter.api.Assertions.assertEquals(1, votos.size());
        org.junit.jupiter.api.Assertions.assertEquals("favorito", votos.get(0).getCategoria());
    }

    private int patchCategoria(long enfId, String userToken, String categoria) throws Exception {
        return mvc.perform(patch("/api/enfrentamientos/" + enfId + "/votar/categoria")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoria", categoria))))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    @TestConfiguration
    static class ClockTestConfig {

        @Bean
        @Primary
        MutableTestClock mutableTestClock() {
            return new MutableTestClock();
        }
    }

    static class MutableTestClock extends Clock {
        private final AtomicReference<Instant> instant = new AtomicReference<>(Instant.parse("2026-05-22T06:42:00Z"));

        void setInstant(Instant instant) {
            this.instant.set(instant);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant.get();
        }
    }
}
