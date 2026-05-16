package com.diegoalegil.animeshowdown.controller;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.VotoHistorialDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.PerfilService;

/**
 * Endpoints REST del perfil del usuario autenticado (Plan v2 §4.1).
 *
 * <p>Todos requieren auth — son sobre el usuario actual ({@code /me}).
 * <ul>
 *   <li>{@code GET /api/perfil/me/stats}</li>
 *   <li>{@code GET /api/perfil/me/historial-votos?page=&size=}</li>
 *   <li>{@code GET /api/perfil/me/top?limit=5}</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/perfil")
public class PerfilController {

    private final PerfilService perfilService;

    public PerfilController(PerfilService perfilService) {
        this.perfilService = perfilService;
    }

    @GetMapping("/me/stats")
    public ResponseEntity<?> miStats(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(perfilService.stats(usuario));
    }

    @GetMapping("/me/historial-votos")
    public ResponseEntity<?> miHistorialVotos(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Page<VotoHistorialDto> result = perfilService.historialVotos(usuario, page, size);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/me/top")
    public ResponseEntity<?> miTop(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "5") int limit) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(perfilService.top(usuario, limit));
    }
}
