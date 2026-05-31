package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.TierListDto;
import com.diegoalegil.animeshowdown.dto.TierListSaveRequest;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.TierListService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/tier-lists")
public class TierListController {

    private final TierListService tierListService;

    public TierListController(TierListService tierListService) {
        this.tierListService = tierListService;
    }

    @GetMapping("/mine")
    public List<TierListDto> mine(@AuthenticationPrincipal Usuario usuario) {
        return tierListService.listarMias(exigirUsuario(usuario));
    }

    @GetMapping("/{id}")
    public TierListDto own(@AuthenticationPrincipal Usuario usuario, @PathVariable Long id) {
        return tierListService.mia(exigirUsuario(usuario), id);
    }

    @PostMapping
    public ResponseEntity<TierListDto> create(
            @AuthenticationPrincipal Usuario usuario,
            @Valid @RequestBody TierListSaveRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(tierListService.crear(exigirUsuario(usuario), request));
    }

    @PutMapping("/{id}")
    public TierListDto update(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable Long id,
            @Valid @RequestBody TierListSaveRequest request) {
        return tierListService.actualizar(exigirUsuario(usuario), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Usuario usuario, @PathVariable Long id) {
        tierListService.eliminar(exigirUsuario(usuario), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/public/{slug}")
    public TierListDto publicBySlug(@PathVariable String slug) {
        return tierListService.publica(slug);
    }

    private static Usuario exigirUsuario(Usuario usuario) {
        if (usuario == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Necesitas iniciar sesión");
        }
        return usuario;
    }
}
