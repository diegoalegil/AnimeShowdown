package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.FavoritoItemDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.PersonajeFavoritoService;

import jakarta.persistence.EntityNotFoundException;

/**
 * Endpoints "Mi roster / favoritos".
 *
 * <p>Todos requieren auth (la regla en {@link com.diegoalegil.animeshowdown.config.SecurityConfig}
 * cubre los paths). El controller usa {@link AuthenticationPrincipal}
 * para resolver el usuario — sin riesgo de exponer favoritos ajenos
 * porque las queries del service filtran SIEMPRE por el usuario inyectado
 * por Spring Security, no por un parámetro de query.
 *
 * <p>Filosofía idempotente: POST/DELETE no fallan si el estado ya era
 * el deseado. El frontend hace optimistic update sin necesidad de
 * reconciliar estados raros.
 */
@RestController
public class PersonajeFavoritoController {

    private final PersonajeFavoritoService favoritoService;

    public PersonajeFavoritoController(PersonajeFavoritoService favoritoService) {
        this.favoritoService = favoritoService;
    }

    /** Roster del usuario autenticado. */
    @GetMapping("/api/me/favoritos")
    public List<FavoritoItemDto> misFavoritos(@AuthenticationPrincipal Usuario usuario) {
        return favoritoService.listarMisFavoritos(usuario);
    }

    /**
     * Sigue al personaje. 200 con {following: true, created: true|false}
     * según si la relación se creó ahora (created=true) o ya existía
     * (created=false). 404 si el slug no existe.
     */
    @PostMapping("/api/personajes/{slug}/favorito")
    public ResponseEntity<Map<String, Object>> seguir(
            @PathVariable String slug,
            @AuthenticationPrincipal Usuario usuario) {
        try {
            boolean created = favoritoService.seguir(usuario, slug);
            return ResponseEntity.ok(Map.of("following", true, "created", created));
        } catch (EntityNotFoundException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Deja de seguir. 200 con {following: false, removed: true|false}
     * (removed=false si no estaba siguiendo, idempotente). 404 si slug
     * no existe.
     */
    @DeleteMapping("/api/personajes/{slug}/favorito")
    public ResponseEntity<Map<String, Object>> dejarDeSeguir(
            @PathVariable String slug,
            @AuthenticationPrincipal Usuario usuario) {
        try {
            boolean removed = favoritoService.dejarDeSeguir(usuario, slug);
            return ResponseEntity.ok(Map.of("following", false, "removed", removed));
        } catch (EntityNotFoundException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * ¿Sigo a este personaje? Devuelve {following: bool}. Útil para
     * que la ficha pinte el estado del botón Heart desde el servidor
     * sin tener que pedir toda la lista.
     */
    @GetMapping("/api/personajes/{slug}/favorito")
    public ResponseEntity<Map<String, Boolean>> estado(
            @PathVariable String slug,
            @AuthenticationPrincipal Usuario usuario) {
        try {
            boolean following = favoritoService.estaSiguiendo(usuario, slug);
            return ResponseEntity.ok(Map.of("following", following));
        } catch (EntityNotFoundException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
