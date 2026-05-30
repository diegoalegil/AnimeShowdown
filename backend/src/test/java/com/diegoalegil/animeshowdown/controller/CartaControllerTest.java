package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.event.DueloLiveFinalizadoEvent;
import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
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
class CartaControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;
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
    void monederoArrancaEnCeroYRequiereAuth() throws Exception {
        mvc.perform(get("/api/me/monedero")).andExpect(status().isForbidden());

        String token = token("cartas_saldo0");
        mvc.perform(get("/api/me/monedero").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saldo").value(0));
    }

    @Test
    void abrirSobreSinSaldoDevuelve409() throws Exception {
        String token = token("cartas_sinsaldo");
        mvc.perform(post("/api/me/cartas/sobre").header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
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

        // Abrir un sobre: gasta 100 y revela una carta SSR con su personaje.
        mvc.perform(post("/api/me/cartas/sobre").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.carta.personajeSlug").isNotEmpty())
                .andExpect(jsonPath("$.carta.rareza").value("SSR"))
                .andExpect(jsonPath("$.carta.poseida").value(true))
                .andExpect(jsonPath("$.nueva").value(true))
                .andExpect(jsonPath("$.precio").value(100))
                .andExpect(jsonPath("$.saldoRestante").value(150));

        // La colección refleja la carta obtenida + el saldo restante.
        mvc.perform(get("/api/me/cartas").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saldo").value(150))
                .andExpect(jsonPath("$.totalPoseidas").value(1))
                .andExpect(jsonPath("$.totalCatalogo").isNumber())
                .andExpect(jsonPath("$.cartas[?(@.poseida == true)]").isNotEmpty());
    }

    @Test
    void dropPorVotoEsMisionDiariaIdempotente() throws Exception {
        token("cartas_voto");
        Usuario u = usuario("cartas_voto");
        CartaDropListener listener = listenerSincrono();
        assertThat(monederoService.saldoDe(u)).isZero();

        // Primer voto del día = misión diaria completada (drop de 15).
        listener.onVoto(new VotoRegistradoEvent(u, null));
        assertThat(monederoService.saldoDe(u)).isEqualTo(15L);

        // Votar otra vez el mismo día NO vuelve a dropear la misión diaria.
        listener.onVoto(new VotoRegistradoEvent(u, null));
        assertThat(monederoService.saldoDe(u)).isEqualTo(15L);
    }

    @Test
    void dropsPorTorneoYDueloAcreditanAlGanador() throws Exception {
        token("cartas_juego");
        Usuario u = usuario("cartas_juego");
        CartaDropListener listener = listenerSincrono();

        listener.onPrediccionResuelta(
                new PrediccionResueltaEvent(u.getId(), u.getUsername(), 3, 1));
        assertThat(monederoService.saldoDe(u)).isEqualTo(25L);

        listener.onDueloFinalizado(new DueloLiveFinalizadoEvent(101L, u.getId()));
        assertThat(monederoService.saldoDe(u)).isEqualTo(45L);

        // Ganó el bot (ganador null) o usuario inexistente → no acredita a nadie.
        listener.onDueloFinalizado(new DueloLiveFinalizadoEvent(102L, null));
        listener.onPrediccionResuelta(
                new PrediccionResueltaEvent(99999999L, "fantasma", 5, 1));
        assertThat(monederoService.saldoDe(u)).isEqualTo(45L);
    }
}
