package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import jakarta.persistence.EntityManagerFactory;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonajeCatalogoBusquedaControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private EntityManagerFactory entityManagerFactory;

    @Test
    void listarTodosSinPaginacionMantieneArrayBackwardCompatible() throws Exception {
        mvc.perform(get("/api/personajes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].slug").exists())
                .andExpect(jsonPath("$.content").doesNotExist());
    }

    @Test
    void listarTodosConPaginacionDevuelvePageResponse() throws Exception {
        mvc.perform(get("/api/personajes")
                        .param("page", "0")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(5)))
                .andExpect(jsonPath("$.totalElements", greaterThan(5)))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.first").value(true));
    }

    @Test
    void catalogoDevuelveCamposCompactosCacheYEtag() throws Exception {
        MvcResult first = mvc.perform(get("/api/personajes/catalogo")
                        .param("fields", "slug,nombre,anime,imagenUrl,imagenColorDominante"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("s-maxage=3600")))
                .andExpect(header().exists(HttpHeaders.ETAG))
                .andExpect(jsonPath("$[0].slug").exists())
                .andExpect(jsonPath("$[0].nombre").exists())
                .andExpect(jsonPath("$[0].anime").exists())
                .andExpect(jsonPath("$[0].imagenUrl").exists())
                .andExpect(jsonPath("$[0].imagenColorDominante").exists())
                .andExpect(jsonPath("$[0].descripcion").doesNotExist())
                .andReturn();

        String etag = first.getResponse().getHeader(HttpHeaders.ETAG);
        mvc.perform(get("/api/personajes/catalogo")
                        .param("fields", "slug,nombre,anime,imagenUrl,imagenColorDominante")
                        .header(HttpHeaders.IF_NONE_MATCH, etag))
                .andExpect(status().isNotModified())
                .andExpect(header().string(HttpHeaders.ETAG, etag));
    }

    @Test
    void buscarOrdenaPorRelevanciaYNoHaceNMasUno() throws Exception {
        var stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        stats.setStatisticsEnabled(true);

        mvc.perform(get("/api/personajes/buscar")
                        .param("q", "luffy")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("luffy"))
                .andExpect(jsonPath("$[0].score").isNumber())
                .andExpect(jsonPath("$[0].descripcion").exists());

        assertThat(stats.getPrepareStatementCount())
                .as("autocomplete debe resolverse con una query de búsqueda, sin cargar relaciones N+1")
                .isLessThanOrEqualTo(1);
    }

    @Test
    void buscarRespetaLimitYMinimoDeQuery() throws Exception {
        mvc.perform(get("/api/personajes/buscar")
                        .param("q", "a")
                        .param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());

        mvc.perform(get("/api/personajes/buscar")
                        .param("q", "suizou")
                        .param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].anime").value("Kimi no Suizou wo Tabetai"));
    }
}
