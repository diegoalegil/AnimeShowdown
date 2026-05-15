package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoIniciarRequest;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.service.TorneoService;

import jakarta.validation.Valid;

/**
 * Controller "delgado": solo orquesta HTTP y delega toda la lógica a
 * TorneoService. Los errores de negocio se propagan como excepciones que
 * GlobalExceptionHandler convierte a respuestas con shape JSON unificado
 * (EntityNotFoundException → 404, IllegalStateException → 409,
 * IllegalArgumentException → 400).
 */
@RestController
@RequestMapping("/api/torneos")
public class TorneoController {

    private final TorneoService torneoService;

    public TorneoController(TorneoService torneoService) {
        this.torneoService = torneoService;
    }

    @GetMapping
    public List<Torneo> listarTodos() {
        return torneoService.listarTodos();
    }

    @PostMapping
    public Torneo crear(@Valid @RequestBody TorneoCrearRequest request) {
        return torneoService.crear(request);
    }

    /**
     * Inicia el torneo. Body opcional con `participantesIds` para que el
     * servicio cree el bracket completo en cascada (Plan v2 §1.1). Si llega
     * sin body, solo cambia estado a IN_PROGRESS y deja la creación de
     * enfrentamientos al endpoint /enfrentamientos.
     */
    @PutMapping("/{id}/iniciar")
    public ResponseEntity<Torneo> iniciar(
            @PathVariable Long id,
            @RequestBody(required = false) TorneoIniciarRequest request) {
        return ResponseEntity.ok(torneoService.iniciar(id, request));
    }

    @PostMapping("/{id}/enfrentamientos")
    public ResponseEntity<List<Enfrentamiento>> crearEnfrentamientos(
            @PathVariable Long id,
            @Valid @RequestBody List<@Valid EnfrentamientoCrearRequest> requests) {
        List<Enfrentamiento> creados = torneoService.crearEnfrentamientos(id, requests);
        return ResponseEntity.status(HttpStatus.CREATED).body(creados);
    }

    @PutMapping("/{id}/finalizar")
    public ResponseEntity<Torneo> finalizar(@PathVariable Long id) {
        return ResponseEntity.ok(torneoService.finalizar(id));
    }
}
