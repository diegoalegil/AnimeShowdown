package com.diegoalegil.animeshowdown.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.diegoalegil.animeshowdown.service.OgImageService;

class OgImageControllerTest {

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        OgImageService service = mock(OgImageService.class);
        byte[] png = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47};
        when(service.renderPersonaje(anyString())).thenReturn(png);
        when(service.renderTorneo(anyString())).thenReturn(png);
        when(service.renderAnime(anyString())).thenReturn(png);
        when(service.renderRanking()).thenReturn(png);
        when(service.renderHome()).thenReturn(png);
        when(service.renderPvp()).thenReturn(png);
        when(service.renderDuelo(anyString(), anyString())).thenReturn(png);
        // Usuario existente -> png; el resto (incl. "no-existe") queda sin
        // stub y Mockito devuelve null, lo que el controller traduce a 404.
        when(service.renderUsuario("existe")).thenReturn(png);
        mvc = MockMvcBuilders.standaloneSetup(new OgImageController(service)).build();
    }

    @Test
    void endpointsOgDevuelvenPngCacheable() throws Exception {
        assertOg("/api/og/personaje/levi_ackerman.png");
        assertOg("/api/og/torneo/shonen-showdown.png");
        assertOg("/api/og/ranking.png");
        assertOg("/api/og/home.png");
        assertOg("/api/og/anime/naruto.png");
        assertOg("/api/og/pvp.png");
        assertOg("/api/og/duelo/naruto_uzumaki/vs/monkey_d_luffy.png");
    }

    @Test
    void usuarioExistenteDevuelvePngCacheable() throws Exception {
        assertOg("/api/og/usuario/existe.png");
    }

    @Test
    void usuarioInexistenteDevuelve404() throws Exception {
        mvc.perform(get("/api/og/usuario/no-existe.png"))
                .andExpect(status().isNotFound());
    }

    private void assertOg(String path) throws Exception {
        mvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=604800, public"));
    }
}
