package com.diegoalegil.animeshowdown.controller;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.JikanService;
import com.diegoalegil.animeshowdown.service.TorneoAutoService;
import com.diegoalegil.animeshowdown.service.TorneoService;

class AdminAuditControllerTest {

    @Test
    void importarPersonajesRegistraOperacionAdmin() {
        JikanService jikanService = mock(JikanService.class);
        EmailFailureRepository emailFailures = mock(EmailFailureRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        AdminController controller = new AdminController(jikanService, emailFailures, auditLogService);
        Usuario admin = admin();
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(jikanService.importarTopPersonajes(12)).thenReturn(List.of());

        controller.importarPersonajes(12, admin, request);

        verify(auditLogService).registrarAdmin(
                eq(admin),
                eq("admin.personajes.importar"),
                argThat(detalles -> detalles.get("cantidadSolicitada").equals(12)
                        && detalles.get("importados").equals(0)),
                eq(request));
    }

    @Test
    void aprobarTorneoRegistraOperacionAdmin() {
        TorneoService torneoService = mock(TorneoService.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        AdminTorneoController controller = new AdminTorneoController(torneoService, auditLogService);
        Usuario admin = admin();
        MockHttpServletRequest request = new MockHttpServletRequest();
        Torneo torneo = torneo(7L, "copa-test", "Copa test");
        when(torneoService.aprobar(7L)).thenReturn(torneo);

        controller.aprobar(7L, admin, request);

        verify(auditLogService).registrarAdmin(
                eq(admin),
                eq("admin.torneos.aprobar"),
                argThat(detalles -> detalles.get("torneoId").equals(7L)
                        && detalles.get("slug").equals("copa-test")),
                eq(request));
    }

    @Test
    void rechazarTorneoNoPersisteMotivoCompletoEnAudit() {
        TorneoService torneoService = mock(TorneoService.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        AdminTorneoController controller = new AdminTorneoController(torneoService, auditLogService);
        Usuario admin = admin();
        MockHttpServletRequest request = new MockHttpServletRequest();
        Torneo torneo = torneo(8L, "copa-rechazada", "Copa rechazada");
        when(torneoService.rechazar(8L, "motivo privado")).thenReturn(torneo);
        AdminTorneoController.RechazoRequest body = new AdminTorneoController.RechazoRequest();
        body.setMotivo("motivo privado");

        controller.rechazar(8L, body, admin, request);

        verify(auditLogService).registrarAdmin(
                eq(admin),
                eq("admin.torneos.rechazar"),
                argThat(detalles -> detalles.get("torneoId").equals(8L)
                        && detalles.get("motivoLength").equals(14)
                        && !detalles.containsKey("motivo")),
                eq(request));
    }

    @Test
    void autoGenerarTorneoRegistraOperacionAdmin() {
        TorneoAutoService autoService = mock(TorneoAutoService.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        AutoTorneoController controller = new AutoTorneoController(autoService, auditLogService);
        Usuario admin = admin();
        MockHttpServletRequest request = new MockHttpServletRequest();
        Torneo torneo = torneo(9L, "auto-test", "Auto test");
        when(autoService.isEnabled()).thenReturn(true);
        when(autoService.generar(16, true)).thenReturn(torneo);

        controller.autoGenerar(Map.of("tamano", 16, "force", true), admin, request);

        verify(auditLogService).registrarAdmin(
                eq(admin),
                eq("admin.torneos.auto-generar"),
                argThat(detalles -> detalles.get("torneoId").equals(9L)
                        && detalles.get("tamano").equals(16)
                        && detalles.get("force").equals(true)),
                eq(request));
    }

    private static Usuario admin() {
        return new Usuario("admin", "password", "admin@example.com");
    }

    private static Torneo torneo(Long id, String slug, String nombre) {
        Torneo torneo = new Torneo();
        torneo.setId(id);
        torneo.setSlug(slug);
        torneo.setNombre(nombre);
        return torneo;
    }
}
