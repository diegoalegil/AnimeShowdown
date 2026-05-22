package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

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
    private com.diegoalegil.animeshowdown.repository.MadrugadorDiaRepository madrugadorDiaRepository;

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

    @Test
    void migrarVotosAnonimosAsociaHistorialAlLogin() throws Exception {
        String adminToken = tokenAdmin();
        long[] ids = dosPersonajes();
        String anonId = "anon-migrate-session";
        long enfId = crearEnfrentamientoListoParaVotar(adminToken, ids[0], ids[1], "anon-migrate");

        mvc.perform(post("/api/enfrentamientos/" + enfId + "/votar")
                .header("X-AS-Anonymous-Id", anonId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("personajeGanadorId", ids[0]))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anonimo").value(true));

        String token = tokenUserRegistrado("anon_migrate_user", "anon-migrate@example.com");
        mvc.perform(post("/api/perfil/me/migrar-votos-anonimos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("anonSessionId", anonId))))
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
    void votarPublicaDeltaRankingPorWebSocket() throws Exception {
        reset(messaging);
        String adminToken = tokenAdmin();
        String userToken = tokenUserRegistrado("voto_ws_user", "votows@example.com");
        long[] ids = dosPersonajes();
        long antes = votoRepository.countByPersonajeId(ids[0]);
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
        org.junit.jupiter.api.Assertions.assertEquals(antes + 1, ev.getVotos());
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

    /**
     * Regresión audit P2 (2026-05-17): BadgeEventListener escucha
     * VotoRegistradoEvent en AFTER_COMMIT con @Async. Si el endpoint /votar
     * no abriera tx, el evento se publicaría fuera de tx y AFTER_COMMIT lo
     * descartaría silenciosamente → primer_voto nunca se desbloquearía. Este
     * test confirma la cadena entera end-to-end:
     *   controller @Transactional → publishEvent → AFTER_COMMIT → @Async listener
     *   → BadgeService.desbloquear → UsuarioLogro persistido en BBDD.
     *
     * <p>Nota técnica: este test NO usa TestAsyncConfig (SyncTaskExecutor)
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
            if (!usuarioLogroRepository.findByUsuarioOrderByDesbloqueadoEnDesc(u).isEmpty()) {
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
     * Regresión audit P1 (2026-05-17): antes existía un uniqueConstraint global
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
