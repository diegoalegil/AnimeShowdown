package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.NotificacionDto;
import com.diegoalegil.animeshowdown.dto.PageResponse;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.NotificacionService;

/**
 * Endpoints REST de notificaciones in-app.
 *
 * <ul>
 *   <li>{@code GET /api/notificaciones?soloNoLeidas=false&page=0&size=20}
 *       — historial paginado del usuario.</li>
 *   <li>{@code GET /api/notificaciones/unread-count} — count para el
 *       badge de la campanita en el header.</li>
 *   <li>{@code POST /api/notificaciones/{id}/leida} — marca una como
 *       leída. Solo el dueño puede.</li>
 *   <li>{@code POST /api/notificaciones/marcar-todas-leidas} — masivo.</li>
 * </ul>
 *
 * <p>Todos requieren autenticación (regla por defecto en SecurityConfig:
 * {@code anyRequest().authenticated()}).
 */
@RestController
@RequestMapping("/api/notificaciones")
public class NotificacionController {

    private static final int MAX_PAGE_SIZE = 100;

    private final NotificacionService notificacionService;

    public NotificacionController(NotificacionService notificacionService) {
        this.notificacionService = notificacionService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<NotificacionDto>> listar(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(name = "soloNoLeidas", defaultValue = "false") boolean soloNoLeidas,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        int sanePage = Math.max(0, page);
        int saneSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        PageResponse<NotificacionDto> pageResult = PageResponse.from(notificacionService
                .listar(usuario, PageRequest.of(sanePage, saneSize), soloNoLeidas)
                .map(NotificacionDto::from));
        return ResponseEntity.ok(pageResult);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> unreadCount(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(Map.of("count", notificacionService.countNoLeidas(usuario)));
    }

    @PostMapping("/{id}/leida")
    public ResponseEntity<?> marcarLeida(@PathVariable Long id,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return notificacionService.marcarLeida(id, usuario)
                .map(n -> ResponseEntity.ok(NotificacionDto.from(n)))
                // Mismo 404 para "no existe" que para "no es tuya" — no
                // filtramos información de notificaciones de otros usuarios.
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/marcar-todas-leidas")
    public ResponseEntity<?> marcarTodasLeidas(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        int actualizadas = notificacionService.marcarTodasLeidas(usuario);
        return ResponseEntity.ok(Map.of("actualizadas", actualizadas));
    }
}
