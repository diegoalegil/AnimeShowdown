package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.FeedService;

/**
 * Feed de comunidad (B7 §2). Requiere auth: es sobre los seguidos del usuario
 * actual. La autorización la cubre {@code anyRequest().authenticated()} de
 * SecurityConfig (no hay regla permitAll para /api/feed).
 */
@RestController
@RequestMapping("/api/feed")
public class FeedController {

    private final FeedService feedService;

    public FeedController(FeedService feedService) {
        this.feedService = feedService;
    }

    @GetMapping
    public ResponseEntity<?> feed(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(feedService.feed(usuario, page, size));
    }
}
