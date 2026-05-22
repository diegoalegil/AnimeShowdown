package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.DueloLiveStateDto;
import com.diegoalegil.animeshowdown.dto.DueloLiveVoteRequest;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.security.ClientIpExtractor;
import com.diegoalegil.animeshowdown.service.DueloLiveService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/duelo-live")
public class DueloLiveController {

    private final DueloLiveService dueloLiveService;
    private final ClientIpExtractor clientIpExtractor;

    public DueloLiveController(DueloLiveService dueloLiveService, ClientIpExtractor clientIpExtractor) {
        this.dueloLiveService = dueloLiveService;
        this.clientIpExtractor = clientIpExtractor;
    }

    @PostMapping("/queue")
    public DueloLiveStateDto entrarCola(@AuthenticationPrincipal Usuario usuario, HttpServletRequest request) {
        return dueloLiveService.entrarCola(usuario, clientIpExtractor.extract(request));
    }

    @GetMapping("/active")
    public ResponseEntity<DueloLiveStateDto> activo(@AuthenticationPrincipal Usuario usuario) {
        DueloLiveStateDto state = dueloLiveService.miDueloActivo(usuario);
        return state == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(state);
    }

    @GetMapping("/{id}")
    public DueloLiveStateDto estado(@PathVariable Long id, @AuthenticationPrincipal Usuario usuario) {
        return dueloLiveService.estado(id, usuario);
    }

    @PostMapping("/{id}/vote")
    public DueloLiveStateDto votar(@PathVariable Long id,
            @AuthenticationPrincipal Usuario usuario,
            @Valid @RequestBody DueloLiveVoteRequest request) {
        return dueloLiveService.votar(id, usuario, request.choice());
    }

    @PostMapping("/{id}/leave")
    public DueloLiveStateDto abandonar(@PathVariable Long id, @AuthenticationPrincipal Usuario usuario) {
        return dueloLiveService.abandonar(id, usuario);
    }
}
