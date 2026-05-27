package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.EmailFailure;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.JikanService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    private final JikanService jikanService;
    private final EmailFailureRepository emailFailureRepository;
    private final AuditLogService auditLogService;

    public AdminController(
            JikanService jikanService,
            EmailFailureRepository emailFailureRepository,
            AuditLogService auditLogService) {
        this.jikanService = jikanService;
        this.emailFailureRepository = emailFailureRepository;
        this.auditLogService = auditLogService;
    }

    @PostMapping("/personajes/importar")
    public ResponseEntity<List<Personaje>> importarPersonajes(
            @RequestParam(defaultValue = "10") int cantidad,
            @AuthenticationPrincipal Usuario admin,
            HttpServletRequest request) {
        log.info("Importación Jikan iniciada: cantidad solicitada={}", cantidad);
        List<Personaje> importados = jikanService.importarTopPersonajes(cantidad);
        log.info("Importación Jikan completada: {} personajes guardados", importados.size());
        auditLogService.registrarAdmin(admin, "admin.personajes.importar", Map.of(
                "cantidadSolicitada", cantidad,
                "importados", importados.size()), request);
        return ResponseEntity.ok(importados);
    }

    /**
     * Dead letter queue de emails que fallaron tras los 3 reintentos
     *. Útil para diagnóstico cuando Resend tiene un
     * incidente: aquí queda el contenido + error_msg de cada envío caído
     * para inspección y reenvío manual.
     */
    @GetMapping("/email-failures")
    public ResponseEntity<Map<String, Object>> listarEmailFailures() {
        List<EmailFailure> fallos = emailFailureRepository.findAllByOrderByTsDesc();
        long noReintentados = emailFailureRepository.countByReintentadoFalse();
        return ResponseEntity.ok(Map.of(
                "total", fallos.size(),
                "pendientesReintento", noReintentados,
                "fallos", fallos));
    }
}
