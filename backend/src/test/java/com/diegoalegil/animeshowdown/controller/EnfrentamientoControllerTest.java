package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
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
import java.util.concurrent.Executor;
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
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.dto.BracketUpdateEvent;
import com.diegoalegil.animeshowdown.dto.RankingDeltaEvent;
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

    @Autowired
    private com.diegoalegil.animeshowdown.repository.VotoRepository votoRepository;

    @Autowired
    private com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository enfrentamientoRepository;

    @Autowired
    private com.diegoalegil.animeshowdown.repository.MadrugadorDiaRepository madrugadorDiaRepository;

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private AnonymousIdentityService anonymousIdentityService;

    @MockitoBean
    private SimpMessagingTemplate messaging;

    @Autowired
    private MutableTestClock clock;

    @Autowired
    @Qualifier("taskExecutor")
    private Executor taskExecutor;

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

    @Test
    void votarAnonimoPermiteCincoVotosYSextoDevuelve429() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        String anonId = "anon-session-test-123";
        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);

        for (int i = 0; i < 5; i++) {
            long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-" + i);
            mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                    .header("X-AS-Anonymous-Id", anonId)
                    .header("X-AS-Anonymous-Fingerprint", "fp-test")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.anonimo").value(true))
                    .andExpect(jsonPath("$.delta").value(org.hamcrest.Matchers.closeTo(0.3, 0.001)))
                    .andExpect(jsonPath("$.votosAnonimosRestantes").value(4 - i));
        }

        long sexto = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-6");
        mvc.perform(post("/api/enfrentamientos/" + sexto + "/votar")
                .header("X-AS-Anonymous-Id", anonId)
                .header("X-AS-Anonymous-Fingerprint", "fp-test")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.votosAnonimosRestantes").value(0));

        org.junit.jupiter.api.Assertions.assertEquals(5, votoRepository.countByAnonSessionId(anonId));
    }

    /**
     * R3-1 / SEC-001 (regresión): el anti-fraude de voto anónimo no puede
     * evadirse rotando X-Forwarded-For. Escenario de vote-stuffing real: un
     * atacante pega directo al backend y, por petición, rota la cookie de
     * sesión (para saltarse el tope de 5 votos por sesión) y rota
     * X-Forwarded-For (para intentar saltarse el throttle por IP).
     *
     * <p>ANTES del fix la IP del hash salía de X-Forwarded-For crudo y el
     * hash incluía sesión + fingerprint, así que cada voto caía en un
     * bucket distinto y el throttle por IP NUNCA disparaba (los 11 votos
     * pasaban con 200). AHORA el hash es IP-real (ClientIpExtractor) +
     * User-Agent, estable frente a esa rotación, y al superar el umbral
     * soft (10/h) el throttle responde 428 PRECONDITION_REQUIRED.
     */
    @Test
    void votarAnonimoRotandoXForwardedForNoEvadeElThrottlePorIp() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "xff-stuffing");
        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);

        // 11 votos > umbral soft (app.anon-abuse.soft-per-hour=10) desde la
        // MISMA conexión (RemoteAddr 127.0.0.1, mismo User-Agent), rotando
        // sesión y X-Forwarded-For en cada petición.
        List<Integer> estados = new java.util.ArrayList<>();
        for (int i = 0; i < 11; i++) {
            int status = mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                    .header("X-AS-Anonymous-Id", "anon-xff-stuffing-" + i) // sesión nueva → evade el tope de 5
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
        String anonId = "anon-dup-session";
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-dup");
        Map<String, Long> body = Map.of("personajeGanadorId", ids[0]);

        // Primer voto OK
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("X-AS-Anonymous-Id", anonId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anonimo").value(true));

        // Segundo voto MISMA sesión + MISMO match: 409 Conflict.
        // El check de aplicación lo intercepta antes de llegar al constraint.
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("X-AS-Anonymous-Id", anonId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
                .andExpect(status().isConflict());

        // Solo un voto debe quedar en la BBDD, no dos.
        org.junit.jupiter.api.Assertions.assertEquals(
                1,
                votoRepository.countByAnonSessionId(anonId),
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
                    .header("X-AS-Anonymous-Id", "anon-peso-" + i)
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
    void votarEmpateNeutralSumaMedioACadaPersonajeSinMoverRankingDelta() throws Exception {
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
        verify(messaging, never()).convertAndSend(eq("/topic/ranking-delta"), any(RankingDeltaEvent.class));
    }

    @Test
    void votarInvalidaCacheDelRankingAllTime() throws Exception {
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_cache_user", "votocache@example.com");
        long[] ids = dosPersonajes();

        mvc.perform(get("/api/votos/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.personaje.id == " + ids[0] + ")]").doesNotExist());

        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "cache-ranking");
        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        mvc.perform(get("/api/votos/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.personaje.id == " + ids[0] + ")]").exists());
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
                .header("X-AS-Anonymous-Id", "anon-ws-peso")
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
        long esperado = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-auth-2");

        mvc.perform(post("/api/enfrentamientos/" + yaVotado + "/votar")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var request = get("/api/enfrentamientos/siguiente")
                .header("Authorization", "Bearer " + userToken);
        String excludeIds = idsAbiertosExcepto(yaVotado, esperado);
        if (!excludeIds.isBlank()) {
            request.param("excludeIds", excludeIds);
        }
        mvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(esperado));
    }

    @Test
    void siguienteAnonimoOmiteEnfrentamientosYaVotadosPorLaMismaSesion() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        String anonId = "anon-siguiente-session";
        long yaVotado = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-anon-1");
        long esperado = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "sig-anon-2");

        mvc.perform(post("/api/enfrentamientos/" + yaVotado + "/votar")
                .header("X-AS-Anonymous-Id", anonId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var request = get("/api/enfrentamientos/siguiente")
                .header("X-AS-Anonymous-Id", anonId);
        String excludeIds = idsAbiertosExcepto(yaVotado, esperado);
        if (!excludeIds.isBlank()) {
            request.param("excludeIds", excludeIds);
        }
        mvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(esperado));
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
        LocalDate fecha = LocalDate.of(2026, 5, 22);

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        var userA = usuarioRepository.findByUsername("madrugador_a").orElseThrow();
        var userB = usuarioRepository.findByUsername("madrugador_b").orElseThrow();
        esperarMadrugador("luffy", fecha, userA.getId());

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
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

    private String idsAbiertosExcepto(long... idsPermitidos) {
        Set<Long> permitidos = Arrays.stream(idsPermitidos).boxed().collect(Collectors.toSet());
        return enfrentamientoRepository.findAll().stream()
                .filter(enf -> enf.getTorneo().getEstado()
                        == com.diegoalegil.animeshowdown.model.EstadoTorneo.IN_PROGRESS)
                .filter(enf -> enf.getPersonaje1() != null)
                .filter(enf -> enf.getPersonaje2() != null)
                .filter(enf -> enf.getGanador() == null)
                .map(com.diegoalegil.animeshowdown.model.Enfrentamiento::getId)
                .filter(id -> !permitidos.contains(id))
                .map(String::valueOf)
                .collect(Collectors.joining(","));
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
        String anonId = "anon-patch-cat-01";

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("X-AS-Anonymous-Id", anonId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk());

        mvc.perform(patch("/api/enfrentamientos/" + enfId + "/votar/categoria")
                .header("X-AS-Anonymous-Id", anonId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoria", "favorito"))))
                .andExpect(status().isNoContent());

        var votos = votoRepository.findByAnonSessionIdAndUsuarioIsNullOrderByFechaAsc(anonId);
        org.junit.jupiter.api.Assertions.assertEquals(1, votos.size());
        org.junit.jupiter.api.Assertions.assertEquals("favorito", votos.get(0).getCategoria());
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
