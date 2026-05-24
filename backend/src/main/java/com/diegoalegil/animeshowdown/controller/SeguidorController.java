package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.UsuarioPublicoDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.SeguidorService;

/**
 * Endpoints REST de friends / follow.
 *
 * <ul>
 *   <li>{@code POST /api/seguidores/{usuarioId}} — autenticado. Sigue al
 *       usuario indicado. Idempotente.</li>
 *   <li>{@code DELETE /api/seguidores/{usuarioId}} — autenticado.
 *       Deja de seguir.</li>
 *   <li>{@code GET /api/seguidores/usuario/{username}/seguidos} — público.
 *       Lista pública de a quién sigue ese username.</li>
 *   <li>{@code GET /api/seguidores/usuario/{username}/seguidores} — público.</li>
 *   <li>{@code GET /api/seguidores/usuario/{username}/stats} — counts + flag
 *       siguiendo si el caller está autenticado.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/seguidores")
public class SeguidorController {

    private final SeguidorService seguidorService;
    private final UsuarioRepository usuarioRepository;

    public SeguidorController(SeguidorService seguidorService,
            UsuarioRepository usuarioRepository) {
        this.seguidorService = seguidorService;
        this.usuarioRepository = usuarioRepository;
    }

    @PostMapping("/{usuarioId}")
    public ResponseEntity<?> seguir(@PathVariable Long usuarioId,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            boolean nuevo = seguidorService.seguir(usuario, usuarioId);
            return ResponseEntity.ok(Map.of("seguido", true, "nuevo", nuevo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{usuarioId}")
    public ResponseEntity<?> dejarDeSeguir(@PathVariable Long usuarioId,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        boolean borrado = seguidorService.dejarDeSeguir(usuario, usuarioId);
        return ResponseEntity.ok(Map.of("seguido", false, "borrado", borrado));
    }

    @GetMapping("/usuario/{username}/seguidos")
    public ResponseEntity<?> seguidosDe(@PathVariable String username) {
        return usuarioRepository.findByUsername(username)
                .map(u -> {
                    List<UsuarioPublicoDto> dtos = seguidorService.listarSeguidos(u).stream()
                            .map(UsuarioPublicoDto::from).toList();
                    return ResponseEntity.<Object>ok(dtos);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/usuario/{username}/seguidores")
    public ResponseEntity<?> seguidoresDe(@PathVariable String username) {
        return usuarioRepository.findByUsername(username)
                .map(u -> {
                    List<UsuarioPublicoDto> dtos = seguidorService.listarSeguidores(u).stream()
                            .map(UsuarioPublicoDto::from).toList();
                    return ResponseEntity.<Object>ok(dtos);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/usuario/{username}/stats")
    public ResponseEntity<?> stats(@PathVariable String username,
            @AuthenticationPrincipal Usuario caller) {
        return usuarioRepository.findByUsername(username)
                .map(u -> {
                    long seguidos = seguidorService.countSeguidos(u);
                    long seguidores = seguidorService.countSeguidores(u);
                    boolean siguiendo = caller != null
                            && !caller.getId().equals(u.getId())
                            && seguidorService.estaSiguiendo(caller, u.getId());
                    return ResponseEntity.<Object>ok(Map.of(
                            "username", u.getUsername(),
                            "seguidos", seguidos,
                            "seguidores", seguidores,
                            "siguiendo", siguiendo,
                            "esMismoUsuario", caller != null && caller.getId().equals(u.getId())));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
