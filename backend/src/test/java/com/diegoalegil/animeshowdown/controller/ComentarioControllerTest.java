package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.model.ComentarioEstado;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.repository.ComentarioRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ComentarioControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private ComentarioRepository comentarioRepository;

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

    private String adminToken(String username) throws Exception {
        String token = token(username);
        usuarioRepository.findByUsername(username).ifPresent(u -> {
            u.setRol(Rol.ADMIN);
            u.setEstadoVerificacion(EstadoVerificacion.ACTIVO);
            usuarioRepository.save(u);
        });
        return token;
    }

    private long crearComentario(String token, String contenido) throws Exception {
        MvcResult res = mvc.perform(post("/api/personajes/luffy/comentarios")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("contenido", contenido))))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(res.getResponse().getContentAsString()).get("id").asLong();
    }

    private int crearComentarioStatus(String token, String contenido) throws Exception {
        return mvc.perform(post("/api/personajes/luffy/comentarios")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("contenido", contenido))))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    private int reportarStatus(String token, long comentarioId) throws Exception {
        return mvc.perform(post("/api/comentarios/" + comentarioId + "/reportar")
                .header("Authorization", "Bearer " + token))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    @Test
    void usuarioComentaYListadoPublicoSoloMuestraVisibles() throws Exception {
        String token = token("coment_visible_user");

        crearComentario(token, "Luffy merece estar arriba del ranking.");

        mvc.perform(get("/api/personajes/luffy/comentarios")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].contenido").value("Luffy merece estar arriba del ranking."))
                .andExpect(jsonPath("$.content[0].estado").value("VISIBLE"))
                .andExpect(jsonPath("$.content[0].autor.username").value("coment_visible_user"));
    }

    @Test
    void profanidadQuedaPendienteYAdminPuedeOcultarla() throws Exception {
        String user = token("coment_profanity_user");
        String admin = adminToken("coment_profanity_admin");

        long id = crearComentario(user, "This matchup is shit y una mierda.");

        mvc.perform(get("/api/personajes/luffy/comentarios")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isEmpty());

        mvc.perform(get("/api/admin/comentarios")
                        .header("Authorization", "Bearer " + admin)
                        .param("estado", "PENDIENTE_REVISION"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(id))
                .andExpect(jsonPath("$.content[0].estado").value("PENDIENTE_REVISION"));

        mvc.perform(put("/api/admin/comentarios/" + id + "/estado")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("estado", "OCULTO"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("OCULTO"));
    }

    @Test
    void usuarioReportaYAutorPuedeEliminarCubriendoEstadosRestantes() throws Exception {
        String autor = token("coment_report_autor");
        String reportero = token("coment_report_reportero");

        long id = crearComentario(autor, "Comentario visible pero polémico.");

        // Un único reporte cuenta pero NO oculta el comentario (umbral por defecto = 3):
        // antes un solo reporte de cualquiera lo pasaba a PENDIENTE_REVISION (censura trivial).
        mvc.perform(post("/api/comentarios/" + id + "/reportar")
                        .header("Authorization", "Bearer " + reportero))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("VISIBLE"))
                .andExpect(jsonPath("$.reportes").value(1));

        mvc.perform(delete("/api/comentarios/" + id)
                        .header("Authorization", "Bearer " + autor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ELIMINADO"))
                .andExpect(jsonPath("$.contenido").value("[comentario eliminado]"));
    }

    @Test
    void elComentarioSeOcultaSoloAlAlcanzarElUmbralDeReportes() throws Exception {
        String autor = token("coment_umbral_autor");
        long id = crearComentario(autor, "Comentario polemico pero visible.");

        // Dos reportes de usuarios DISTINTOS: el comentario sigue VISIBLE (umbral = 3).
        mvc.perform(post("/api/comentarios/" + id + "/reportar")
                        .header("Authorization", "Bearer " + token("coment_umbral_r1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("VISIBLE"))
                .andExpect(jsonPath("$.reportes").value(1));
        mvc.perform(post("/api/comentarios/" + id + "/reportar")
                        .header("Authorization", "Bearer " + token("coment_umbral_r2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("VISIBLE"))
                .andExpect(jsonPath("$.reportes").value(2));

        // Tercer reportero distinto → alcanza el umbral → PENDIENTE_REVISION.
        mvc.perform(post("/api/comentarios/" + id + "/reportar")
                        .header("Authorization", "Bearer " + token("coment_umbral_r3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("PENDIENTE_REVISION"))
                .andExpect(jsonPath("$.reportes").value(3));
    }

    @Test
    void elMismoUsuarioNoPuedeReportarDosVecesNiInflarElContador() throws Exception {
        String autor = token("coment_dedup_autor");
        String reportero = token("coment_dedup_reportero");
        long id = crearComentario(autor, "Comentario para dedup de reportes.");

        mvc.perform(post("/api/comentarios/" + id + "/reportar")
                        .header("Authorization", "Bearer " + reportero))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reportes").value(1));
        // Segundo reporte del MISMO usuario → 409, sin incrementar el contador.
        mvc.perform(post("/api/comentarios/" + id + "/reportar")
                        .header("Authorization", "Bearer " + reportero))
                .andExpect(status().isConflict());
    }

    @Test
    void limitaCincoComentariosPorHoraYUsuario() throws Exception {
        String token = token("coment_rate_user");

        for (int i = 0; i < 5; i++) {
            crearComentario(token, "Comentario de rate limit " + i);
        }

        mvc.perform(post("/api/personajes/luffy/comentarios")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("contenido", "Sexto comentario"))))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void rateLimitConcurrenteConsumeSoloUnCupoFinal() throws Exception {
        String username = "coment_rate_race";
        String token = token(username);

        for (int i = 0; i < 4; i++) {
            crearComentario(token, "Comentario previo de rate limit " + i);
        }

        CountDownLatch inicio = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> primera = executor.submit(() -> {
                assertThat(inicio.await(5, TimeUnit.SECONDS)).isTrue();
                return crearComentarioStatus(token, "Comentario concurrente A");
            });
            Future<Integer> segunda = executor.submit(() -> {
                assertThat(inicio.await(5, TimeUnit.SECONDS)).isTrue();
                return crearComentarioStatus(token, "Comentario concurrente B");
            });

            inicio.countDown();
            List<Integer> statuses = List.of(
                    primera.get(10, TimeUnit.SECONDS),
                    segunda.get(10, TimeUnit.SECONDS));

            assertThat(statuses).containsExactlyInAnyOrder(201, 429);
            var usuario = usuarioRepository.findByUsername(username).orElseThrow();
            long recientes = comentarioRepository.countByAutorAndCreadoEnAfter(
                    usuario,
                    LocalDateTime.now().minusHours(1));
            assertThat(recientes).isEqualTo(5);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void reportesConcurrentesNoPierdenIncrementos() throws Exception {
        String autor = token("coment_report_race_autor");
        String reporteroA = token("coment_report_race_a");
        String reporteroB = token("coment_report_race_b");
        long id = crearComentario(autor, "Comentario visible para reportar en carrera.");

        CountDownLatch inicio = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> primera = executor.submit(() -> {
                assertThat(inicio.await(5, TimeUnit.SECONDS)).isTrue();
                return reportarStatus(reporteroA, id);
            });
            Future<Integer> segunda = executor.submit(() -> {
                assertThat(inicio.await(5, TimeUnit.SECONDS)).isTrue();
                return reportarStatus(reporteroB, id);
            });

            inicio.countDown();
            List<Integer> statuses = List.of(
                    primera.get(10, TimeUnit.SECONDS),
                    segunda.get(10, TimeUnit.SECONDS));

            assertThat(statuses).containsExactly(200, 200);
            var comentario = comentarioRepository.findById(id).orElseThrow();
            // Dos reportes concurrentes de usuarios DISTINTOS suman 2 sin perder
            // incrementos. Con umbral 3 el comentario sigue VISIBLE (antes 1 reporte
            // ya lo ocultaba); haría falta un 3er reportero distinto para PENDIENTE.
            assertThat(comentario.getReportes()).isEqualTo(2);
            assertThat(comentario.getEstado()).isEqualTo(ComentarioEstado.VISIBLE);
        } finally {
            executor.shutdownNow();
        }
    }
}
