package com.diegoalegil.animeshowdown.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ComentarioControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;

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

        mvc.perform(post("/api/comentarios/" + id + "/reportar")
                        .header("Authorization", "Bearer " + reportero))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("PENDIENTE_REVISION"))
                .andExpect(jsonPath("$.reportes").value(1));

        mvc.perform(delete("/api/comentarios/" + id)
                        .header("Authorization", "Bearer " + autor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ELIMINADO"))
                .andExpect(jsonPath("$.contenido").value("[comentario eliminado]"));
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
}
