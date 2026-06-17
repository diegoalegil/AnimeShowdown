package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.WrappedDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.WrappedService;

/**
 * "Wrapped" del usuario. {@code GET /api/wrapped/me} es privado (autenticado por
 * el fallback {@code anyRequest().authenticated()}).
 *
 * <p>Opt-in público (oportunidad b): el dueño puede activar
 * {@code PATCH /api/wrapped/me/publico} para que su Wrapped sea compartible por
 * URL en {@code GET /api/wrapped/u/{username}}. Ese endpoint es {@code permitAll}
 * (ver SecurityConfig) PERO devuelve 404 salvo que el dueño haya hecho opt-in —
 * 404 también si el usuario no existe, para no filtrar qué usernames existen.
 * Los datos del Wrapped son cifras de actividad compartibles (sin PII).
 */
@RestController
@RequestMapping("/api/wrapped")
public class WrappedController {

    private final WrappedService service;
    private final UsuarioRepository usuarioRepository;

    public WrappedController(WrappedService service, UsuarioRepository usuarioRepository) {
        this.service = service;
        this.usuarioRepository = usuarioRepository;
    }

    /** Cuerpo del toggle de opt-in. */
    public record PublicoRequest(boolean publico) {
    }

    @GetMapping("/me")
    public ResponseEntity<WrappedDto> miWrapped(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(service.generar(usuario));
    }

    /**
     * Activa/desactiva que el Wrapped del usuario sea público. Autenticado;
     * persiste el flag y devuelve el Wrapped con {@code publico} ya actualizado.
     */
    @PatchMapping("/me/publico")
    public ResponseEntity<WrappedDto> setPublico(
            @AuthenticationPrincipal Usuario usuario,
            @RequestBody PublicoRequest req) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        usuario.setWrappedPublico(req.publico());
        usuarioRepository.save(usuario);
        return ResponseEntity.ok(service.generar(usuario));
    }

    /**
     * Wrapped PÚBLICO de un usuario por username. Solo responde 200 si el dueño
     * hizo opt-in ({@code wrapped_publico = true}); en cualquier otro caso
     * (no existe, o existe pero es privado) devuelve 404 — mismo código para no
     * revelar la existencia de la cuenta.
     */
    @GetMapping("/u/{username}")
    public ResponseEntity<WrappedDto> wrappedPublico(@PathVariable String username) {
        return usuarioRepository.findByUsername(username)
                .filter(Usuario::isWrappedPublico)
                .map(u -> ResponseEntity.ok(service.generar(u)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
