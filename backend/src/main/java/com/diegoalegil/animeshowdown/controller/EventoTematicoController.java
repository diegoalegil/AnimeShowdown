package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EventoTematicoDto;
import com.diegoalegil.animeshowdown.service.EventoTematicoService;

@RestController
@RequestMapping("/api/eventos")
public class EventoTematicoController {

    private final EventoTematicoService service;

    public EventoTematicoController(EventoTematicoService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<EventoTematicoDto>> listar() {
        return ResponseEntity.ok(service.listarPublicos());
    }

    @GetMapping("/{slug}")
    public ResponseEntity<EventoTematicoDto> detalle(@PathVariable String slug) {
        return service.buscarPublico(slug)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
