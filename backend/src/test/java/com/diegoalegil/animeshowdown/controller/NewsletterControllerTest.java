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
import com.diegoalegil.animeshowdown.repository.NewsletterSubRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests integración del flow de newsletter con double opt-in (Plan v2 §4.8).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestAsyncConfig.class)
class NewsletterControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private NewsletterSubRepository repo;

    @Test
    void suscribirSinAuthDevuelve200() throws Exception {
        mvc.perform(post("/api/newsletter")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "newsletter_alice@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CREADA"));

        var sub = repo.findByEmail("newsletter_alice@example.com").orElseThrow();
        assert !sub.isConfirmado() : "Debe quedar no confirmada hasta el click del email";
        assert sub.getTokenConfirm() != null : "Debe tener token de confirmación";
    }

    @Test
    void emailInvalidoDevuelve400() throws Exception {
        mvc.perform(post("/api/newsletter")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "no-es-un-email"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void confirmarConTokenValidoMarcaConfirmado() throws Exception {
        mvc.perform(post("/api/newsletter")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "newsletter_bob@example.com"))))
                .andExpect(status().isOk());

        var sub = repo.findByEmail("newsletter_bob@example.com").orElseThrow();
        String token = sub.getTokenConfirm();

        mvc.perform(get("/api/newsletter/confirmar?token=" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmado").value(true));

        var subRefresh = repo.findByEmail("newsletter_bob@example.com").orElseThrow();
        assert subRefresh.isConfirmado();
        assert subRefresh.getTokenConfirm() == null : "Token debe consumirse tras confirmar";
    }

    @Test
    void confirmarConTokenInvalidoDevuelve400() throws Exception {
        mvc.perform(get("/api/newsletter/confirmar?token=token-que-no-existe"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.confirmado").value(false));
    }

    @Test
    void reSuscribirEmailExistenteSinConfirmarRefrescaToken() throws Exception {
        // Primera sub
        mvc.perform(post("/api/newsletter")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "newsletter_carla@example.com"))))
                .andExpect(jsonPath("$.estado").value("CREADA"));
        String tokenInicial = repo.findByEmail("newsletter_carla@example.com").orElseThrow().getTokenConfirm();

        // Segunda con el mismo email → REENVIADA, token distinto
        mvc.perform(post("/api/newsletter")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "newsletter_carla@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("REENVIADA"));

        String tokenNuevo = repo.findByEmail("newsletter_carla@example.com").orElseThrow().getTokenConfirm();
        assert !tokenInicial.equals(tokenNuevo) : "El token debe refrescarse en cada reenvío";
    }

    @Test
    void unsubscribeConTokenValidoBorraLaSub() throws Exception {
        mvc.perform(post("/api/newsletter")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "newsletter_diana@example.com"))))
                .andExpect(status().isOk());
        String tokenUnsub = repo.findByEmail("newsletter_diana@example.com").orElseThrow().getTokenUnsubscribe();

        mvc.perform(post("/api/newsletter/unsubscribe?token=" + tokenUnsub))
                .andExpect(status().isOk());

        assert repo.findByEmail("newsletter_diana@example.com").isEmpty()
                : "Tras unsubscribe la fila debe borrarse";
    }
}
