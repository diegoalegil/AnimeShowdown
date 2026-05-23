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
        when(service.renderPvp()).thenReturn(png);
        mvc = MockMvcBuilders.standaloneSetup(new OgImageController(service)).build();
    }

    @Test
    void endpointsOgDevuelvenPngCacheable() throws Exception {
        assertOg("/api/og/personaje/levi_ackerman.png");
        assertOg("/api/og/torneo/shonen-showdown.png");
        assertOg("/api/og/ranking.png");
        assertOg("/api/og/anime/naruto.png");
        assertOg("/api/og/pvp.png");
    }

    private void assertOg(String path) throws Exception {
        mvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=604800, public"));
    }
}
