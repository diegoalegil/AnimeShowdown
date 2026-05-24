package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.EmailFailure;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;
import com.diegoalegil.animeshowdown.service.JikanService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    private final JikanService jikanService;
    private final EmailFailureRepository emailFailureRepository;

    public AdminController(JikanService jikanService, EmailFailureRepository emailFailureRepository) {
        this.jikanService = jikanService;
        this.emailFailureRepository = emailFailureRepository;
    }

    @PostMapping("/personajes/importar")
    public ResponseEntity<List<Personaje>> importarPersonajes(@RequestParam(defaultValue = "10") int cantidad) {
        log.info("Importación Jikan iniciada: cantidad solicitada={}", cantidad);
        List<Personaje> importados = jikanService.importarTopPersonajes(cantidad);
        log.info("Importación Jikan completada: {} personajes guardados", importados.size());
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
