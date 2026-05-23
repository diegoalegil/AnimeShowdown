package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.ReaccionRequest;
import com.diegoalegil.animeshowdown.dto.ReaccionesResumen;
import com.diegoalegil.animeshowdown.model.ReaccionTargetType;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.ReaccionService;

import jakarta.validation.Valid;

/**
 * Endpoints REST de reactions.
 *
 * <ul>
 *   <li>{@code GET /api/reacciones?targetType=&targetId=} — público.
 *       Devuelve el {@link ReaccionesResumen} con counts y la reaction
 *       del usuario actual si está logueado (sino null).</li>
 *   <li>{@code POST /api/reacciones} — autenticado. Body con
 *       {targetType, targetId, tipo}. Lógica toggle/swap en el service.
 *       Devuelve el resumen post-mutación.</li>
 * </ul>
 *
 * <p>Sin DELETE explícito — se obtiene clicando el mismo emoji que ya
 * tienes (toggle off). El frontend no necesita conocer el método.
 */
@RestController
@RequestMapping("/api/reacciones")
public class ReaccionController {

    private final ReaccionService reaccionService;

    public ReaccionController(ReaccionService reaccionService) {
        this.reaccionService = reaccionService;
    }

    @GetMapping
    public ResponseEntity<ReaccionesResumen> resumen(
            @RequestParam ReaccionTargetType targetType,
            @RequestParam Long targetId,
            @AuthenticationPrincipal Usuario usuario) {
        return ResponseEntity.ok(reaccionService.resumen(targetType, targetId, usuario));
    }

    @PostMapping
    public ResponseEntity<?> aplicar(@Valid @RequestBody ReaccionRequest request,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Necesitas iniciar sesión para reaccionar."));
        }
        try {
            reaccionService.aplicar(usuario, request.getTargetType(),
                    request.getTargetId(), request.getTipo());
        } catch (IllegalArgumentException e) {
            // el service valida que el target exista
            // y lanza IllegalArgumentException si no. Traducimos a 400 con
            // el mensaje original — útil para clientes mal hechos sin
            // delatar internals de la BBDD.
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
        return ResponseEntity.ok(reaccionService.resumen(
                request.getTargetType(), request.getTargetId(), usuario));
    }
}
