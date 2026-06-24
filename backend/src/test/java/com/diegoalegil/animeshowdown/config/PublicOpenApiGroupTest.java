package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * El grupo OpenAPI "public" (/v3/api-docs/public) expone el contrato de la API
 * de LECTURA pública sin autenticación, y NO documenta admin/auth/me/cron (#18).
 * El spec es solo documentación: no altera la seguridad de ningún endpoint; el
 * spec COMPLETO y Swagger UI siguen detrás de ROLE_ADMIN en producción.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicOpenApiGroupTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void elGrupoPublicoSeSirveSinAuthYSoloDocumentaLecturaPublica() throws Exception {
        // Sin cabecera Authorization: debe responder 200 (permitAll en SecurityConfig).
        String spec = mvc.perform(get("/v3/api-docs/public"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode paths = objectMapper.readTree(spec).path("paths");
        List<String> keys = new ArrayList<>();
        for (Iterator<String> it = paths.fieldNames(); it.hasNext();) {
            keys.add(it.next());
        }

        // Incluye la superficie de lectura pública...
        assertThat(keys).isNotEmpty();
        assertThat(keys).anyMatch(k -> k.startsWith("/api/personajes"));
        // ...y NUNCA documenta superficie sensible (comprobado sobre las claves
        // reales de `paths`, no sobre menciones incidentales en descripciones).
        assertThat(keys).noneMatch(k -> k.startsWith("/api/admin"));
        assertThat(keys).noneMatch(k -> k.startsWith("/api/auth"));
        assertThat(keys).noneMatch(k -> k.startsWith("/api/me"));
        assertThat(keys).noneMatch(k -> k.startsWith("/api/cron"));
    }
}
