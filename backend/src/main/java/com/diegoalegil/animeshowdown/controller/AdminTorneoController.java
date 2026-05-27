package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.TorneoMioDto;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.TorneoService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Cola admin de torneos creados por usuarios.
 *
 * <p>Todos los endpoints exigen rol ADMIN — `/api/admin/**` está protegido
 * en {@code SecurityConfig}. El admin ve los pendientes FIFO, aprueba (que
 * además los inicia automáticamente) o rechaza con motivo. Las decisiones
 * disparan notificaciones in-app al creador vía {@code TorneoService}.
 */
@RestController
@RequestMapping("/api/admin/torneos")
public class AdminTorneoController {

    private final TorneoService torneoService;
    private final AuditLogService auditLogService;

    public AdminTorneoController(TorneoService torneoService, AuditLogService auditLogService) {
        this.torneoService = torneoService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/pendientes")
    public List<TorneoMioDto> listarPendientes() {
        return torneoService.listarPendientesRevision().stream()
                .map(TorneoMioDto::from)
                .toList();
    }

    @PutMapping("/{id}/aprobar")
    public ResponseEntity<Torneo> aprobar(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario admin,
            HttpServletRequest request) {
        Torneo torneo = torneoService.aprobar(id);
        auditLogService.registrarAdmin(admin, "admin.torneos.aprobar", detallesTorneo(id, torneo), request);
        return ResponseEntity.ok(torneo);
    }

    @PutMapping("/{id}/rechazar")
    public ResponseEntity<Torneo> rechazar(
            @PathVariable Long id,
            @Valid @RequestBody RechazoRequest body,
            @AuthenticationPrincipal Usuario admin,
            HttpServletRequest request) {
        Torneo torneo = torneoService.rechazar(id, body.getMotivo());
        Map<String, Object> detalles = detallesTorneo(id, torneo);
        detalles.put("motivoLength", body.getMotivo().length());
        auditLogService.registrarAdmin(admin, "admin.torneos.rechazar", detalles, request);
        return ResponseEntity.ok(torneo);
    }

    private static Map<String, Object> detallesTorneo(Long requestId, Torneo torneo) {
        Map<String, Object> detalles = new LinkedHashMap<>();
        detalles.put("torneoId", torneo.getId() != null ? torneo.getId() : requestId);
        if (torneo.getSlug() != null) detalles.put("slug", torneo.getSlug());
        if (torneo.getNombre() != null) detalles.put("nombre", torneo.getNombre());
        return detalles;
    }

    /**
     * Body del PUT /rechazar — campo único {@code motivo} con tamaño
     * acotado para que el creador lo lea sin scroll y para no almacenar
     * párrafos arbitrarios en una columna TEXT abierta.
     */
    public static class RechazoRequest {
        @NotBlank(message = "El motivo es obligatorio")
        @Size(min = 5, max = 500, message = "El motivo debe tener entre 5 y 500 caracteres")
        private String motivo;

        public String getMotivo() {
            return motivo;
        }

        public void setMotivo(String motivo) {
            this.motivo = motivo;
        }
    }
}
