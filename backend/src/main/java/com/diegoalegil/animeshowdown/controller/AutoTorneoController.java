package com.diegoalegil.animeshowdown.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.TorneoAutoService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Endpoint admin para auto-generar torneos. Lo invoca el GitHub Action
 * `.github/workflows/auto-tournament.yml` cada 3 días con secret ADMIN_TOKEN.
 *
 * Protegido por SecurityConfig: requiere rol ADMIN.
 */
@RestController
@RequestMapping("/api/admin/torneos")
public class AutoTorneoController {

    private final TorneoAutoService autoService;
    private final AuditLogService auditLogService;

    public AutoTorneoController(TorneoAutoService autoService, AuditLogService auditLogService) {
        this.autoService = autoService;
        this.auditLogService = auditLogService;
    }

    @PostMapping("/auto-generar")
    public ResponseEntity<?> autoGenerar(
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Usuario admin,
            HttpServletRequest request) {
        if (!autoService.isEnabled()) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("error", "Auto-generación deshabilitada");
            resp.put("hint", "Activa con app.tournament.auto.enabled=true en application.properties");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(resp);
        }

        int tamano = 8;
        boolean force = false;
        if (body != null) {
            Object t = body.get("tamano");
            if (t instanceof Number) tamano = ((Number) t).intValue();
            Object f = body.get("force");
            if (f instanceof Boolean) force = (Boolean) f;
        }
        String eventoSlug = extraerEventoSlug(body);

        try {
            Torneo creado = eventoSlug == null
                    ? autoService.generar(tamano, force)
                    : autoService.generar(tamano, force, eventoSlug);
            Map<String, Object> detallesAudit = new HashMap<>();
            detallesAudit.put("tamano", tamano);
            detallesAudit.put("force", force);
            if (eventoSlug != null) detallesAudit.put("eventoSlug", eventoSlug);
            if (creado.getId() != null) detallesAudit.put("torneoId", creado.getId());
            if (creado.getSlug() != null) detallesAudit.put("slug", creado.getSlug());
            auditLogService.registrarAdmin(admin, "admin.torneos.auto-generar", detallesAudit, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(creado);
        } catch (TorneoAutoService.IdempotenciaException e) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("error", e.getMessage());
            resp.put("torneo_existente", e.getExistente());
            resp.put("hint", "Pasa force=true en el body para forzar otro torneo");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(resp);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/auto-historial")
    public ResponseEntity<?> autoHistorial() {
        Optional<Torneo> reciente = autoService.torneoAutoReciente();
        Map<String, Object> resp = new HashMap<>();
        resp.put("auto_enabled", autoService.isEnabled());
        resp.put("torneo_reciente_24h", reciente.orElse(null));
        return ResponseEntity.ok(resp);
    }

    private static String extraerEventoSlug(Map<String, Object> body) {
        if (body == null) return null;
        Object raw = body.get("eventoSlug");
        if (!(raw instanceof String slug) || slug.isBlank()) return null;
        return slug.trim();
    }
}
