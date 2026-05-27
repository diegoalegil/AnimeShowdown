package com.diegoalegil.animeshowdown.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ObservabilityControllerTest {

    @Autowired private MockMvc mvc;

    @Test
    void healthExponeHeadersDeSeguridadBasicos() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                .andExpect(header().string(
                        "Permissions-Policy",
                        "camera=(), microphone=(), geolocation=()"))
                .andExpect(header().string("Cross-Origin-Opener-Policy", "same-origin"))
                .andExpect(header().string("Cross-Origin-Resource-Policy", "same-site"));
    }

    @Test
    void prometheusExponeMetricasCustomDeAnimeShowdown() throws Exception {
        // El test pasa el secret de scrape (configurado en
        // application-test.properties) en el header X-Prometheus-Token.
        // el endpoint ya no es público y exige
        // este header para responder 200 con el body de métricas.
        mvc.perform(get("/actuator/prometheus")
                        .header("X-Prometheus-Token", "test-prometheus-token-no-secret"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("as_votos_total")))
                .andExpect(content().string(containsString("as_ranking_recalc_duration")))
                .andExpect(content().string(containsString("as_duelo_sugerido_elo_diff")));
    }

    @Test
    void prometheusSinTokenDevuelve401() throws Exception {
        mvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", "X-Prometheus-Token"));
    }

    @Test
    void prometheusConTokenIncorrectoDevuelve401() throws Exception {
        mvc.perform(get("/actuator/prometheus")
                        .header("X-Prometheus-Token", "token-erroneo"))
                .andExpect(status().isUnauthorized());
    }
}
