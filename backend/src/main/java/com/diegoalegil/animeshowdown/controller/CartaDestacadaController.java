package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.CartaDestacadaService;

/**
 * Carta destacada del perfil del usuario autenticado. {@code /api/me/**} queda
 * autenticado por el fallback {@code anyRequest().authenticated()}.
 */
@RestController
@RequestMapping("/api/me/cartas")
public class CartaDestacadaController {

    private final CartaDestacadaService service;

    public CartaDestacadaController(CartaDestacadaService service) {
        this.service = service;
    }

    /** Carta destacada actual del usuario, o 204 si no tiene ninguna. */
    @GetMapping("/destacada")
    public ResponseEntity<CartaDto> miDestacada(@AuthenticationPrincipal Usuario usuario) {
        return service.obtenerDestacada(usuario)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** Fija como destacada una carta que el usuario posee. */
    @PutMapping("/{cartaId}/destacada")
    public CartaDto destacar(
            @PathVariable Long cartaId,
            @AuthenticationPrincipal Usuario usuario) {
        return service.destacar(usuario, cartaId);
    }

    /** Quita la destacada (idempotente: si no había, no hace nada). */
    @DeleteMapping("/destacada")
    public ResponseEntity<Void> quitar(@AuthenticationPrincipal Usuario usuario) {
        service.quitar(usuario);
        return ResponseEntity.noContent().build();
    }
}
