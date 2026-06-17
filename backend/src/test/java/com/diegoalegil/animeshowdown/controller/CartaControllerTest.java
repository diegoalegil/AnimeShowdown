package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.event.DueloLiveFinalizadoEvent;
import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.CartaTradeRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.CartaDropListener;
import com.diegoalegil.animeshowdown.service.MonederoService;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Integración de la API de cartas: odds transparentes, ganar moneda, abrir
 * sobres (server-authoritative) y ver la colección. Cubre además los handlers
 * del dropper invocándolos directamente (los @TransactionalEventListener corren
 * en SyncTaskExecutor en el perfil test).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "app.cartas.especial.probabilidad-base=0",
        "app.cartas.especial.pity-duro=10",
        "app.cartas.duplicado.recompensa=10",
        "app.cartas.cofre-diario.moneda=50"
})
class CartaControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private CartaRepository cartaRepository;
    @Autowired private CartaTradeRepository cartaTradeRepository;
    @Autowired private UsuarioCartaRepository usuarioCartaRepository;
    @Autowired private MonederoService monederoService;
    @Autowired private CartaDropListener cartaDropListener;

    private String token(String username) throws Exception {
        String email = username + "@example.com";
        mvc.perform(post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123",
                        "email", email))));
        MvcResult res = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                        "username", username,
                        "password", "secreta123"))))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    private Usuario usuario(String username) {
        return usuarioRepository.findByUsername(username).orElseThrow();
    }

    /**
     * Listener sin el proxy @Async para invocarlo de forma síncrona y
     * determinista en el test (el dropper real corre AFTER_COMMIT async en prod).
     */
    private CartaDropListener listenerSincrono() {
        return AopTestUtils.getTargetObject(cartaDropListener);
    }

    @Test
    void oddsSonTransparentesYSsrAlCienPorCiento() throws Exception {
        String token = token("cartas_odds");
        mvc.perform(get("/api/cartas/odds").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precioSobre").value(100))
                .andExpect(jsonPath("$.cartasEnPool").isNumber())
                .andExpect(jsonPath("$.rarezas[0].rareza").value("SSR"))
                .andExpect(jsonPath("$.rarezas[0].probabilidad").value(1.0));
    }

    @Test
    void oddsSonPublicasParaInvitado() throws Exception {
        // Sin Authorization: un invitado debe ver las odds (datos de diseño
        // globales) — transparencia antes de registrarse. Antes daba 401.
        mvc.perform(get("/api/cartas/odds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precioSobre").value(100))
                .andExpect(jsonPath("$.rarezas[0].rareza").value("SSR"))
                .andExpect(jsonPath("$.rarezas[0].probabilidad").value(1.0));
    }

    @Test
    void monederoArrancaEnCeroYRequiereAuth() throws Exception {
        mvc.perform(get("/api/me/monedero")).andExpect(status().isForbidden());

        String token = token("cartas_saldo0");
        mvc.perform(get("/api/me/monedero").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saldo").value(0));
    }

    @Test
    void resumenDevuelveAgregadosSinElArrayDeCartas() throws Exception {
        String token = token("cartas_resumen");
        mvc.perform(get("/api/me/cartas/resumen").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCatalogo").isNumber())
                .andExpect(jsonPath("$.totalPoseidas").value(0))
                .andExpect(jsonPath("$.saldo").value(0))
                .andExpect(jsonPath("$.progresoPorAnime").isArray())
                .andExpect(jsonPath("$.progresoPorRareza").isArray())
                .andExpect(jsonPath("$.progresoPorRareza[0].rareza").exists())
                // El resumen NO debe incluir el array completo de cartas.
                .andExpect(jsonPath("$.cartas").doesNotExist());
    }

    @Test
    void resumenRequiereAuth() throws Exception {
        mvc.perform(get("/api/me/cartas/resumen")).andExpect(status().isForbidden());
    }

    @Test
    void paginaTroceaElCatalogoYReportaHayMas() throws Exception {
        String token = token("cartas_pagina");
        // Total del catálogo desde el resumen para comparar con totalFiltrado.
        var resumen = mvc.perform(get("/api/me/cartas/resumen")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        int totalCatalogo = json.readTree(resumen.getResponse().getContentAsString())
                .get("totalCatalogo").asInt();

        mvc.perform(get("/api/me/cartas/pagina?offset=0&limit=5")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offset").value(0))
                .andExpect(jsonPath("$.limit").value(5))
                .andExpect(jsonPath("$.totalFiltrado").value(totalCatalogo))
                .andExpect(jsonPath("$.cartas.length()").value(Math.min(5, totalCatalogo)))
                .andExpect(jsonPath("$.hayMas").value(totalCatalogo > 5));
    }

    @Test
    void paginaFiltraPorRarezaEspecial() throws Exception {
        String token = token("cartas_pagina_especial");
        var res = mvc.perform(get("/api/me/cartas/pagina?rareza=ESPECIAL&limit=50")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        var cartas = json.readTree(res.getResponse().getContentAsString()).get("cartas");
        // Todas las cartas devueltas son de la rareza pedida.
        for (var carta : cartas) {
            org.junit.jupiter.api.Assertions.assertEquals(
                    "ESPECIAL", carta.get("rareza").asText());
        }
    }

    @Test
    void abrirSobreSinSaldoDevuelve409() throws Exception {
        String token = token("cartas_sinsaldo");
        mvc.perform(post("/api/me/cartas/sobre")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", "sin-saldo-1"))
                .andExpect(status().isConflict());
    }

    @Test
    void abrirSobreSinIdempotencyKeyDevuelve400YNoDebita() throws Exception {
        String token = token("cartas_sin_idem");
        Usuario u = usuario("cartas_sin_idem");
        monederoService.acreditar(u, MotivoMovimiento.DROP_VOTO, "seed:sin-idem", 250L);

        mvc.perform(post("/api/me/cartas/sobre")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "X-Idempotency-Key es obligatorio para abrir sobres"));

        assertThat(monederoService.saldoDe(u)).isEqualTo(250L);
    }

    @Test
    void reclamarSobreBienvenidaGratisPersisteAperturaConPrecioCero() throws Exception {
        // P0: el sobre de bienvenida persiste un SobreApertura con precio=0. Si el
        // schema exige precio>0 (V44 CHECK), el INSERT falla en Postgres real y un
        // usuario NUEVO no puede reclamar su sobre (el gancho de activación). Este
        // test corre el save de verdad contra el schema (H2+Flyway, sin mocks), así
        // que un constraint mal modelado lo rompe — lo que CartaServiceTest (repos
        // mockeados) no detectaba.
        String token = token("cartas_bienvenida");

        mvc.perform(post("/api/me/cartas/sobre-bienvenida")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cartas.length()").value(5))
                .andExpect(jsonPath("$.precio").value(0));

        // Segunda llamada: idempotente (devuelve la misma apertura, 200, no doble).
        mvc.perform(post("/api/me/cartas/sobre-bienvenida")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cartas.length()").value(5))
                .andExpect(jsonPath("$.precio").value(0));
    }

    @Test
    void ganarMonedaAbrirSobreYVerColeccion() throws Exception {
        String token = token("cartas_flujo");
        Usuario u = usuario("cartas_flujo");

        // El servidor acredita moneda al jugar (aquí simulamos el crédito directo).
        monederoService.acreditar(u, MotivoMovimiento.DROP_VOTO, "seed:flujo", 250L);

        mvc.perform(get("/api/me/monedero").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saldo").value(250));

        // Abrir un sobre: gasta 100 y revela 4 normales + 1 clímax top.
        mvc.perform(post("/api/me/cartas/sobre")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", "flujo-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cartas.length()").value(5))
                .andExpect(jsonPath("$.carta.personajeSlug").isNotEmpty())
                .andExpect(jsonPath("$.carta.rareza").value("SSR"))
                .andExpect(jsonPath("$.cartas[4].climax").value("TOP"))
                .andExpect(jsonPath("$.cartas[4].carta.rareza").value("SSR"))
                .andExpect(jsonPath("$.carta.poseida").value(true))
                .andExpect(jsonPath("$.nueva").value(true))
                .andExpect(jsonPath("$.pityAntes").value(0))
                .andExpect(jsonPath("$.pityDespues").value(1))
                .andExpect(jsonPath("$.precio").value(100))
                .andExpect(jsonPath("$.saldoRestante").value(150));

        // La colección refleja las 5 cartas obtenidas + el saldo restante.
        mvc.perform(get("/api/me/cartas").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saldo").value(150))
                .andExpect(jsonPath("$.totalPoseidas").value(5))
                .andExpect(jsonPath("$.pityActual").value(1))
                .andExpect(jsonPath("$.pityDuro").value(10))
                .andExpect(jsonPath("$.cofreDiarioDisponible").value(true))
                .andExpect(jsonPath("$.progresoPorAnime").isArray())
                .andExpect(jsonPath("$.totalCatalogo").isNumber())
                .andExpect(jsonPath("$.cartas[?(@.poseida == true)]").isNotEmpty());
    }

    @Test
    void abrirSobreConIdempotencyKeyNoDebitaDosVeces() throws Exception {
        String token = token("cartas_idem");
        Usuario u = usuario("cartas_idem");
        monederoService.acreditar(u, MotivoMovimiento.DROP_VOTO, "seed:idem", 100L);

        MvcResult primera = mvc.perform(post("/api/me/cartas/sobre")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", "pack-test-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cartas.length()").value(5))
                .andExpect(jsonPath("$.saldoRestante").value(0))
                .andReturn();

        MvcResult repetida = mvc.perform(post("/api/me/cartas/sobre")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", "pack-test-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saldoRestante").value(0))
                .andReturn();

        assertThat(json.readTree(repetida.getResponse().getContentAsString()).get("cartas"))
                .isEqualTo(json.readTree(primera.getResponse().getContentAsString()).get("cartas"));
        assertThat(monederoService.saldoDe(u)).isZero();
    }

    @Test
    void pityGarantizaEspecialEnElDecimoSobreSecoYResetea() throws Exception {
        String token = token("cartas_pity");
        Usuario u = usuario("cartas_pity");
        monederoService.acreditar(u, MotivoMovimiento.DROP_VOTO, "seed:pity", 1_000L);

        for (int i = 1; i <= 9; i++) {
            mvc.perform(post("/api/me/cartas/sobre")
                    .header("Authorization", "Bearer " + token)
                    .header("X-Idempotency-Key", "pity-" + i))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.especial").value(false))
                    .andExpect(jsonPath("$.cartas[4].climax").value("TOP"))
                    .andExpect(jsonPath("$.pityDespues").value(i));
        }

        mvc.perform(post("/api/me/cartas/sobre")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", "pity-10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.especial").value(true))
                .andExpect(jsonPath("$.cartas.length()").value(5))
                .andExpect(jsonPath("$.cartas[4].climax").value("ESPECIAL"))
                .andExpect(jsonPath("$.cartas[4].carta.rareza").value("ESPECIAL"))
                .andExpect(jsonPath("$.pityAntes").value(9))
                .andExpect(jsonPath("$.pityDespues").value(0));
    }

    @Test
    void duplicadosSeConviertenEnMoneda() throws Exception {
        String token = token("cartas_duplicados");
        Usuario u = usuario("cartas_duplicados");
        monederoService.acreditar(u, MotivoMovimiento.DROP_VOTO, "seed:dupes", 100L);
        for (Carta carta : cartaRepository.findAll()) {
            if (carta.getRareza() == RarezaCarta.SSR) {
                usuarioCartaRepository.save(new UsuarioCarta(u, carta));
            }
        }

        mvc.perform(post("/api/me/cartas/sobre")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", "dupes-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monedasDuplicados").value(50))
                .andExpect(jsonPath("$.saldoRestante").value(50))
                .andExpect(jsonPath("$.cartas[0].nueva").value(false))
                .andExpect(jsonPath("$.cartas[0].recompensaDuplicado").value(10));
    }

    @Test
    void cofreDiarioAcreditaUnaVezPorDia() throws Exception {
        String token = token("cartas_cofre");
        Usuario u = usuario("cartas_cofre");

        mvc.perform(post("/api/me/cartas/cofre-diario").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aplicado").value(true))
                .andExpect(jsonPath("$.cantidad").value(50))
                .andExpect(jsonPath("$.saldo").value(50));

        mvc.perform(post("/api/me/cartas/cofre-diario").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aplicado").value(false))
                .andExpect(jsonPath("$.cantidad").value(50))
                .andExpect(jsonPath("$.saldo").value(50));

        assertThat(monederoService.saldoDe(u)).isEqualTo(50L);
    }

    @Test
    void tradingRequiereIdempotencyKeyYEvitaDuplicados() throws Exception {
        String tokenA = token("cartas_trade_idem_a");
        token("cartas_trade_idem_b");
        Usuario a = usuario("cartas_trade_idem_a");
        Usuario b = usuario("cartas_trade_idem_b");
        Carta cartaA = crearCartaManual("cartas_trade_idem_a_slug", "Trade Idem A");
        Carta cartaB = crearCartaManual("cartas_trade_idem_b_slug", "Trade Idem B");
        usuarioCartaRepository.save(new UsuarioCarta(a, cartaA));
        usuarioCartaRepository.save(new UsuarioCarta(b, cartaB));

        Map<String, Object> sinKey = Map.of(
                "destinatarioUsername", b.getUsername(),
                "cartaOfrecidaId", cartaA.getId(),
                "cartaSolicitadaId", cartaB.getId());
        mvc.perform(post("/api/me/cartas/trades")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(sinKey)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "idempotencyKey es obligatorio para crear intercambios"));

        Map<String, Object> body = Map.of(
                "destinatarioUsername", b.getUsername(),
                "cartaOfrecidaId", cartaA.getId(),
                "cartaSolicitadaId", cartaB.getId(),
                "idempotencyKey", "trade-idem-1");
        long primero = crearTrade(tokenA, body);
        long repetido = crearTrade(tokenA, body);

        assertThat(repetido).isEqualTo(primero);
        assertThat(cartaTradeRepository.findByParticipante(a))
                .filteredOn(t -> "trade-idem-1".equals(t.getIdempotencyKey()))
                .hasSize(1);
    }

    @Test
    void tradingBloqueaSelfTradeYCartaNoPoseida() throws Exception {
        String tokenA = token("cartas_trade_block_a");
        token("cartas_trade_block_b");
        Usuario a = usuario("cartas_trade_block_a");
        Usuario b = usuario("cartas_trade_block_b");
        Carta cartaA = crearCartaManual("cartas_trade_block_a_slug", "Trade Block A");
        Carta cartaB = crearCartaManual("cartas_trade_block_b_slug", "Trade Block B");
        usuarioCartaRepository.save(new UsuarioCarta(b, cartaB));

        mvc.perform(post("/api/me/cartas/trades")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "destinatarioUsername", a.getUsername(),
                                "cartaOfrecidaId", cartaA.getId(),
                                "cartaSolicitadaId", cartaB.getId(),
                                "idempotencyKey", "trade-self-1"))))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/me/cartas/trades")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "destinatarioUsername", b.getUsername(),
                                "cartaOfrecidaId", cartaA.getId(),
                                "cartaSolicitadaId", cartaB.getId(),
                                "idempotencyKey", "trade-no-own-1"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void tradingAceptaOfertaYTransfiereCopiasServerAuthoritative() throws Exception {
        String tokenA = token("cartas_trade_ok_a");
        String tokenB = token("cartas_trade_ok_b");
        Usuario a = usuario("cartas_trade_ok_a");
        Usuario b = usuario("cartas_trade_ok_b");
        Carta cartaA = crearCartaManual("cartas_trade_ok_a_slug", "Trade OK A");
        Carta cartaB = crearCartaManual("cartas_trade_ok_b_slug", "Trade OK B");
        usuarioCartaRepository.save(new UsuarioCarta(a, cartaA));
        usuarioCartaRepository.save(new UsuarioCarta(b, cartaB));

        long tradeId = crearTrade(tokenA, Map.of(
                "destinatarioUsername", b.getUsername(),
                "cartaOfrecidaId", cartaA.getId(),
                "cartaSolicitadaId", cartaB.getId(),
                "idempotencyKey", "trade-ok-1"));

        mvc.perform(post("/api/me/cartas/trades/{tradeId}/accept", tradeId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ACCEPTED"))
                .andExpect(jsonPath("$.rol").value("DESTINATARIO"));

        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(a.getId(), cartaA.getId())).isEmpty();
        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(a.getId(), cartaB.getId())).isPresent();
        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(b.getId(), cartaA.getId())).isPresent();
        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(b.getId(), cartaB.getId())).isEmpty();
    }

    @Test
    void tradingBloqueaActoresNoAutorizadosYPermiteResolverPorActorCorrecto() throws Exception {
        String tokenA = token("cartas_trade_auth_a");
        String tokenB = token("cartas_trade_auth_b");
        String tokenC = token("cartas_trade_auth_c");
        Usuario a = usuario("cartas_trade_auth_a");
        Usuario b = usuario("cartas_trade_auth_b");
        Carta cartaA = crearCartaManual("cartas_trade_auth_a_slug", "Trade Auth A");
        Carta cartaB = crearCartaManual("cartas_trade_auth_b_slug", "Trade Auth B");
        usuarioCartaRepository.save(new UsuarioCarta(a, cartaA));
        usuarioCartaRepository.save(new UsuarioCarta(b, cartaB));

        long tradeId = crearTrade(tokenA, Map.of(
                "destinatarioUsername", b.getUsername(),
                "cartaOfrecidaId", cartaA.getId(),
                "cartaSolicitadaId", cartaB.getId(),
                "idempotencyKey", "trade-auth-1"));

        mvc.perform(post("/api/me/cartas/trades/{tradeId}/accept", tradeId)
                        .header("Authorization", "Bearer " + tokenC))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/me/cartas/trades/{tradeId}/reject", tradeId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/me/cartas/trades/{tradeId}/cancel", tradeId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/me/cartas/trades/{tradeId}/cancel", tradeId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CANCELLED"));
    }

    @Test
    void tradingBloqueaAceptacionSiLaColeccionCambio() throws Exception {
        String tokenA = token("cartas_trade_cambio_a");
        String tokenB = token("cartas_trade_cambio_b");
        Usuario a = usuario("cartas_trade_cambio_a");
        Usuario b = usuario("cartas_trade_cambio_b");
        Carta cartaA = crearCartaManual("cartas_trade_cambio_a_slug", "Trade Cambio A");
        Carta cartaB = crearCartaManual("cartas_trade_cambio_b_slug", "Trade Cambio B");
        usuarioCartaRepository.save(new UsuarioCarta(a, cartaA));
        usuarioCartaRepository.save(new UsuarioCarta(b, cartaB));

        long tradeId = crearTrade(tokenA, Map.of(
                "destinatarioUsername", b.getUsername(),
                "cartaOfrecidaId", cartaA.getId(),
                "cartaSolicitadaId", cartaB.getId(),
                "idempotencyKey", "trade-conflict-1"));

        UsuarioCarta perdida = usuarioCartaRepository
                .findByUsuarioIdAndCartaId(b.getId(), cartaB.getId())
                .orElseThrow();
        usuarioCartaRepository.delete(perdida);
        usuarioCartaRepository.flush();

        mvc.perform(post("/api/me/cartas/trades/{tradeId}/accept", tradeId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isConflict());

        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(a.getId(), cartaA.getId())).isPresent();
        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(a.getId(), cartaB.getId())).isEmpty();
    }

    @Test
    void tradingDobleAceptacionConcurrenteSoloPermiteUna() throws Exception {
        String tokenA = token("cartas_trade_race_a");
        String tokenB = token("cartas_trade_race_b");
        Usuario a = usuario("cartas_trade_race_a");
        Usuario b = usuario("cartas_trade_race_b");
        Carta cartaA = crearCartaManual("cartas_trade_race_a_slug", "Trade Race A");
        Carta cartaB = crearCartaManual("cartas_trade_race_b_slug", "Trade Race B");
        usuarioCartaRepository.save(new UsuarioCarta(a, cartaA));
        usuarioCartaRepository.save(new UsuarioCarta(b, cartaB));

        long tradeId = crearTrade(tokenA, Map.of(
                "destinatarioUsername", b.getUsername(),
                "cartaOfrecidaId", cartaA.getId(),
                "cartaSolicitadaId", cartaB.getId(),
                "idempotencyKey", "trade-race-1"));

        CountDownLatch salida = new CountDownLatch(1);
        AtomicInteger ok = new AtomicInteger();
        AtomicInteger conflict = new AtomicInteger();
        try (var pool = Executors.newFixedThreadPool(2)) {
            for (int i = 0; i < 2; i++) {
                pool.submit(() -> {
                    try {
                        salida.await(5, TimeUnit.SECONDS);
                        int statusCode = mvc.perform(post("/api/me/cartas/trades/{tradeId}/accept", tradeId)
                                        .header("Authorization", "Bearer " + tokenB))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                        if (statusCode == 200) {
                            ok.incrementAndGet();
                        } else if (statusCode == 409) {
                            conflict.incrementAndGet();
                        }
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                });
            }
            salida.countDown();
            pool.shutdown();
            assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }

        assertThat(ok.get()).isEqualTo(1);
        assertThat(conflict.get()).isEqualTo(1);
        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(a.getId(), cartaB.getId())).isPresent();
        assertThat(usuarioCartaRepository.findByUsuarioIdAndCartaId(b.getId(), cartaA.getId())).isPresent();
    }

    @Test
    void descargarCartaPoseidaDevuelvePngConWatermark() throws Exception {
        String token = token("cartas_descarga_ok");
        Usuario u = usuario("cartas_descarga_ok");
        Carta carta = crearCartaManual("carta_descarga_ok_slug", "Carta Descarga");
        usuarioCartaRepository.save(new UsuarioCarta(u, carta));

        MvcResult res = mvc.perform(get("/api/me/cartas/{id}/descargar", carta.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("carta-carta_descarga_ok_slug.png")))
                .andReturn();

        BufferedImage png = ImageIO.read(new ByteArrayInputStream(res.getResponse().getContentAsByteArray()));
        assertThat(png.getWidth()).isEqualTo(1024);
        assertThat(png.getHeight()).isEqualTo(1536);
        assertThat(tieneWatermarkEnBandaInferior(png)).isTrue();
    }

    @Test
    void descargarCartaNoPoseidaDevuelve403() throws Exception {
        String token = token("cartas_descarga_403");
        Carta carta = crearCartaManual("carta_descarga_403_slug", "Carta Ajena");

        mvc.perform(get("/api/me/cartas/{id}/descargar", carta.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void dropPorVotoEsMisionDiariaIdempotente() throws Exception {
        token("cartas_voto");
        Usuario u = usuario("cartas_voto");
        CartaDropListener listener = listenerSincrono();
        assertThat(monederoService.saldoDe(u)).isZero();

        // Primer voto del día = misión diaria completada (drop de 30).
        listener.onVoto(new VotoRegistradoEvent(u, null));
        assertThat(monederoService.saldoDe(u)).isEqualTo(30L);

        // Votar otra vez el mismo día NO vuelve a dropear la misión diaria.
        listener.onVoto(new VotoRegistradoEvent(u, null));
        assertThat(monederoService.saldoDe(u)).isEqualTo(30L);
    }

    @Test
    void dropsPorTorneoYDueloAcreditanAlGanador() throws Exception {
        token("cartas_juego");
        Usuario u = usuario("cartas_juego");
        CartaDropListener listener = listenerSincrono();

        listener.onPrediccionResuelta(
                new PrediccionResueltaEvent(u.getId(), u.getUsername(), 3, 1));
        assertThat(monederoService.saldoDe(u)).isEqualTo(40L);

        listener.onDueloFinalizado(new DueloLiveFinalizadoEvent(101L, u.getId()));
        assertThat(monederoService.saldoDe(u)).isEqualTo(75L);

        // Ganó el bot (ganador null) o usuario inexistente → no acredita a nadie.
        listener.onDueloFinalizado(new DueloLiveFinalizadoEvent(102L, null));
        listener.onPrediccionResuelta(
                new PrediccionResueltaEvent(99999999L, "fantasma", 5, 1));
        assertThat(monederoService.saldoDe(u)).isEqualTo(75L);
    }

    private Carta crearCartaManual(String slug, String nombre) {
        Personaje p = new Personaje(slug, nombre, "Anime Test", "Personaje test para cartas.", null);
        p.setImagenColorDominante("#9f1d2c");
        p = personajeRepository.save(p);
        return cartaRepository.save(new Carta(p, RarezaCarta.SSR));
    }

    private long crearTrade(String token, Map<String, Object> body) throws Exception {
        MvcResult res = mvc.perform(post("/api/me/cartas/trades")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado").value("PENDING"))
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("id").asLong();
    }

    private boolean tieneWatermarkEnBandaInferior(BufferedImage img) {
        int pixelsGrisTenue = 0;
        for (int y = 1460; y < 1500; y++) {
            for (int x = 250; x < 780; x++) {
                int rgb = img.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                boolean gris = Math.abs(r - g) <= 10 && Math.abs(g - b) <= 10;
                if (gris && r >= 55 && r <= 190) {
                    pixelsGrisTenue++;
                }
            }
        }
        return pixelsGrisTenue > 180;
    }

    @Test
    void salonEspecialesEsPublicoYDevuelveArray() throws Exception {
        // Galería del Salón Legendario: pública (sin auth) y siempre un array JSON.
        mvc.perform(get("/api/cartas/especiales"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
