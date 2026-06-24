package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EventoTematicoDto;
import com.diegoalegil.animeshowdown.dto.EventoTematicoRequest;
import com.diegoalegil.animeshowdown.service.EventoTematicoService;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin/eventos")
public class AdminEventoTematicoController {

    private final EventoTematicoService service;

    public AdminEventoTematicoController(EventoTematicoService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<?> crear(@Valid @RequestBody EventoTematicoRequest request) {
        try {
            EventoTematicoDto creado = service.crear(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(creado);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{slug}")
    public ResponseEntity<?> actualizar(
            @PathVariable String slug,
            @Valid @RequestBody EventoTematicoRequest request) {
        try {
            return ResponseEntity.ok(service.actualizar(slug, request));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<?> desactivar(@PathVariable String slug) {
        try {
            service.desactivar(slug);
            return ResponseEntity.noContent().build();
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
