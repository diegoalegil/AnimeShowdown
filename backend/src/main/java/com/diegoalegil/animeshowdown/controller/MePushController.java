package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.PushSubscribeRequest;
import com.diegoalegil.animeshowdown.dto.PushSubscriptionDto;
import com.diegoalegil.animeshowdown.dto.PushUnsubscribeRequest;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.PushSubscriptionService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/me/push")
public class MePushController {

    private final PushSubscriptionService service;

    public MePushController(PushSubscriptionService service) {
        this.service = service;
    }

    @GetMapping("/public-key")
    public ResponseEntity<?> publicKey(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(service.publicKeyInfo());
    }

    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(
            @AuthenticationPrincipal Usuario usuario,
            @Valid @RequestBody PushSubscribeRequest request) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        PushSubscriptionDto dto = service.subscribe(usuario, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @DeleteMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(
            @AuthenticationPrincipal Usuario usuario,
            @RequestBody(required = false) PushUnsubscribeRequest request) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        int eliminadas = service.unsubscribe(usuario, request != null ? request.endpoint() : null);
        return ResponseEntity.ok(Map.of("eliminadas", eliminadas));
    }
}
