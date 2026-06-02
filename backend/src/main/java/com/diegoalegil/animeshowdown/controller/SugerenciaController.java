package com.diegoalegil.animeshowdown.controller;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.SugerenciaPersonajeDto;
import com.diegoalegil.animeshowdown.dto.SugerirPersonajeRequest;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.SugerenciaPersonajeService;

import jakarta.validation.Valid;

/**
 * Sugerencias de personaje del usuario logueado. {@code /api/sugerencias/**}
 * queda autenticado por el fallback {@code anyRequest().authenticated()} de
 * SecurityConfig (no se monta bajo {@code /api/personajes/**} para no chocar
 * con el matcher POST→ADMIN de esa ruta).
 */
@RestController
@RequestMapping("/api/sugerencias")
public class SugerenciaController {

    private final SugerenciaPersonajeService service;

    public SugerenciaController(SugerenciaPersonajeService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<SugerenciaPersonajeDto> crear(
            @Valid @RequestBody SugerirPersonajeRequest body,
            @AuthenticationPrincipal Usuario usuario) {
        SugerenciaPersonajeDto creada = service.crear(body, usuario);
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    @GetMapping
    public Page<SugerenciaPersonajeDto> misSugerencias(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.listarMias(usuario, page, size);
    }
}
