package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.WrappedDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.WrappedService;

/**
 * "Wrapped" del usuario autenticado. {@code /api/wrapped/me} queda autenticado
 * por el fallback {@code anyRequest().authenticated()}. Los datos son privados
 * (solo el propio usuario); el compartir se hace client-side desde su tarjeta,
 * sin exponer las cifras a crawlers.
 */
@RestController
@RequestMapping("/api/wrapped")
public class WrappedController {

    private final WrappedService service;

    public WrappedController(WrappedService service) {
        this.service = service;
    }

    @GetMapping("/me")
    public ResponseEntity<WrappedDto> miWrapped(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(service.generar(usuario));
    }
}
