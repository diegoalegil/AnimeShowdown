package com.diegoalegil.animeshowdown.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.TorneoAutoService;

class AutoTorneoControllerTest {

    private MockMvc mvc;
    private TorneoAutoService autoService;
    private AuditLogService auditLogService;

    @BeforeEach
    void setUp() {
        autoService = mock(TorneoAutoService.class);
        auditLogService = mock(AuditLogService.class);
        mvc = MockMvcBuilders
                .standaloneSetup(new AutoTorneoController(autoService, auditLogService))
                .build();
    }

    private static Usuario admin() {
        Usuario u = new Usuario("admin", "hash", "admin@test.com");
        u.setId(1L);
        return u;
    }

    @Test
    void autoGenerarConServicioHabilitadoDevuelve201() throws Exception {
        when(autoService.isEnabled()).thenReturn(true);
        when(autoService.generar(8, false)).thenReturn(torneo(42L, "torneo-test"));

        mvc.perform(post("/api/admin/torneos/auto-generar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.slug").value("torneo-test"));

        verify(auditLogService).registrarAdmin(any(), any(), any(), any());
    }

    @Test
    void autoGenerarConServicioDeshabilitadoDevuelve503() throws Exception {
        when(autoService.isEnabled()).thenReturn(false);

        mvc.perform(post("/api/admin/torneos/auto-generar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("Auto-generación deshabilitada"));
    }

    @Test
    void autoGenerarConIdempotenciaDevuelve409() throws Exception {
        when(autoService.isEnabled()).thenReturn(true);
        when(autoService.generar(anyInt(), any()))
                .thenThrow(new TorneoAutoService.IdempotenciaException("Ya existe", torneo(10L, "torneo-existente")));

        mvc.perform(post("/api/admin/torneos/auto-generar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tamano\": 16, \"force\": false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty())
                .andExpect(jsonPath("$.torneo_existente.id").value(10));
    }

    @Test
    void autoGenerarConForceDevuelve201() throws Exception {
        when(autoService.isEnabled()).thenReturn(true);
        when(autoService.generar(16, true)).thenReturn(torneo(99L, "torneo-force"));

        mvc.perform(post("/api/admin/torneos/auto-generar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tamano\": 16, \"force\": true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(99));
    }

    @Test
    void autoHistorialDevuelveEstadoYDetalle() throws Exception {
        when(autoService.isEnabled()).thenReturn(true);
        when(autoService.torneoAutoReciente()).thenReturn(Optional.of(torneo(5L, "torneo-reciente")));

        mvc.perform(get("/api/admin/torneos/auto-historial"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auto_enabled").value(true))
                .andExpect(jsonPath("$.torneo_reciente_24h.id").value(5));
    }

    @Test
    void autoHistorialSinTorneoRecienteDevuelveNull() throws Exception {
        when(autoService.isEnabled()).thenReturn(false);
        when(autoService.torneoAutoReciente()).thenReturn(Optional.empty());

        mvc.perform(get("/api/admin/torneos/auto-historial"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auto_enabled").value(false))
                .andExpect(jsonPath("$.torneo_reciente_24h").doesNotExist());
    }

    private static Torneo torneo(Long id, String slug) {
        Torneo t = new Torneo();
        t.setId(id);
        t.setSlug(slug);
        return t;
    }
}
