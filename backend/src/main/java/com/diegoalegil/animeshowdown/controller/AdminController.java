package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.service.JikanService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    private final JikanService jikanService;

    public AdminController(JikanService jikanService) {
        this.jikanService = jikanService;
    }

    @PostMapping("/personajes/importar")
    public ResponseEntity<List<Personaje>> importarPersonajes(@RequestParam(defaultValue = "10") int cantidad) {
        log.info("Importación Jikan iniciada: cantidad solicitada={}", cantidad);
        List<Personaje> importados = jikanService.importarTopPersonajes(cantidad);
        log.info("Importación Jikan completada: {} personajes guardados", importados.size());
        return ResponseEntity.ok(importados);
    }
}
