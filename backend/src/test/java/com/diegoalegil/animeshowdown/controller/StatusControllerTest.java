package com.diegoalegil.animeshowdown.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.model.UptimeLog;
import com.diegoalegil.animeshowdown.repository.UptimeLogRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StatusControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private UptimeLogRepository uptimeLogRepository;

    @Test
    void statusPublicoAgregaVentanasYNoSeCachea() throws Exception {
        uptimeLogRepository.deleteAll();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        uptimeLogRepository.save(new UptimeLog(now.minusMinutes(3), "UP", 120L, null));
        uptimeLogRepository.save(new UptimeLog(now.minusMinutes(2), "DOWN", 900L, "HTTP 500"));
        uptimeLogRepository.save(new UptimeLog(now.minusMinutes(1), "UP", 180L, null));

        mvc.perform(get("/api/status"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(jsonPath("$.currentStatus").value("UP"))
                .andExpect(jsonPath("$.last24h.checks").value(3))
                .andExpect(jsonPath("$.last24h.uptimePercent").value(66.67))
                .andExpect(jsonPath("$.last24h.avgLatencyMs").value(400))
                .andExpect(jsonPath("$.last24h.p50LatencyMs").value(180))
                .andExpect(jsonPath("$.last24h.downChecks").value(1))
                .andExpect(jsonPath("$.last90d.checks").value(3))
                .andExpect(jsonPath("$.samples.length()").value(3));
    }
}
