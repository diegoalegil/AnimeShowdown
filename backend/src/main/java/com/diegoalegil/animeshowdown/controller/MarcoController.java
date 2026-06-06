package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.MarcosResponse;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.MarcoService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Marcos de avatar (cosmético coin-sink). Todo bajo {@code /api/me/marcos}
 * requiere usuario autenticado (cubierto por {@code anyRequest().authenticated()}
 * en SecurityConfig). Errores de dominio (404/409) los emite
 * {@code MarcoService}/{@code MonederoService} como {@code ResponseStatusException}.
 */
@RestController
@RequestMapping("/api/me/marcos")
public class MarcoController {

    private final MarcoService marcoService;

    public MarcoController(MarcoService marcoService) {
        this.marcoService = marcoService;
    }

    @GetMapping
    public ResponseEntity<MarcosResponse> mios(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(marcoService.estado(usuario));
    }

    @PostMapping("/{marcoId}/comprar")
    public ResponseEntity<MarcosResponse> comprar(@AuthenticationPrincipal Usuario usuario,
                                                  @PathVariable String marcoId,
                                                  HttpServletRequest request) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(marcoService.comprar(usuario, marcoId, request));
    }

    @PostMapping("/equipar")
    public ResponseEntity<MarcosResponse> equipar(@AuthenticationPrincipal Usuario usuario,
                                                  @RequestBody(required = false) EquiparRequest body) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(marcoService.equipar(usuario, body == null ? null : body.marcoId()));
    }

    /** Cuerpo de /equipar; {@code marcoId} null o ausente = desequipar. */
    public record EquiparRequest(String marcoId) {
    }
}
