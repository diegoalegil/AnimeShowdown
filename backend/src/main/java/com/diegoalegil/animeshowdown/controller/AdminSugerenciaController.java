package com.diegoalegil.animeshowdown.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.SugerenciaPersonajeDto;
import com.diegoalegil.animeshowdown.model.SugerenciaEstado;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.SugerenciaPersonajeService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Cola admin de sugerencias de personaje. Todos los endpoints exigen rol ADMIN
 * ({@code /api/admin/**} está protegido en SecurityConfig). Mismo patrón que
 * {@link AdminTorneoController}: cola por estado, aprobar/rechazar con audit log
 * y notificación al proponente.
 */
@RestController
@RequestMapping("/api/admin/sugerencias")
public class AdminSugerenciaController {

    private final SugerenciaPersonajeService service;
    private final AuditLogService auditLogService;

    public AdminSugerenciaController(SugerenciaPersonajeService service, AuditLogService auditLogService) {
        this.service = service;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public Page<SugerenciaPersonajeDto> listar(
            @RequestParam(defaultValue = "PENDIENTE") SugerenciaEstado estado,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.listarPorEstado(estado, page, size);
    }

    @PutMapping("/{id}/aprobar")
    public SugerenciaPersonajeDto aprobar(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario admin,
            HttpServletRequest request) {
        SugerenciaPersonajeDto dto = service.aprobar(id);
        auditLogService.registrarAdmin(admin, "admin.sugerencias.aprobar", detalles(id, dto), request);
        return dto;
    }

    @PutMapping("/{id}/rechazar")
    public SugerenciaPersonajeDto rechazar(
            @PathVariable Long id,
            @Valid @RequestBody RechazoRequest body,
            @AuthenticationPrincipal Usuario admin,
            HttpServletRequest request) {
        SugerenciaPersonajeDto dto = service.rechazar(id, body.getMotivo());
        Map<String, Object> detalles = detalles(id, dto);
        detalles.put("motivoLength", body.getMotivo().length());
        auditLogService.registrarAdmin(admin, "admin.sugerencias.rechazar", detalles, request);
        return dto;
    }

    private static Map<String, Object> detalles(Long id, SugerenciaPersonajeDto dto) {
        Map<String, Object> detalles = new LinkedHashMap<>();
        detalles.put("sugerenciaId", dto.id() != null ? dto.id() : id);
        if (dto.nombre() != null) detalles.put("nombre", dto.nombre());
        if (dto.anime() != null) detalles.put("anime", dto.anime());
        return detalles;
    }

    /** Body del PUT /rechazar — motivo acotado, visible para el proponente. */
    public static class RechazoRequest {
        @NotBlank(message = "El motivo es obligatorio")
        @Size(min = 5, max = 500, message = "El motivo debe tener entre 5 y 500 caracteres")
        private String motivo;

        public String getMotivo() { return motivo; }
        public void setMotivo(String motivo) { this.motivo = motivo; }
    }
}
