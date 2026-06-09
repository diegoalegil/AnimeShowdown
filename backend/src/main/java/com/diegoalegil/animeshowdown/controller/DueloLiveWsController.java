package com.diegoalegil.animeshowdown.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import com.diegoalegil.animeshowdown.dto.DueloLiveVoteRequest;
import com.diegoalegil.animeshowdown.model.DueloLiveChoice;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.DueloLiveService;

@Controller
public class DueloLiveWsController {

    private final DueloLiveService dueloLiveService;

    public DueloLiveWsController(DueloLiveService dueloLiveService) {
        this.dueloLiveService = dueloLiveService;
    }

    @MessageMapping("/duelo/join")
    public void join(Principal principal) {
        dueloLiveService.entrarCola(usuario(principal), null);
    }

    @MessageMapping("/duelo/{id}/vote")
    public void vote(@DestinationVariable Long id, DueloLiveVoteRequest request, Principal principal) {
        dueloLiveService.votar(id, usuario(principal), request.choice());
    }

    @MessageMapping("/duelo/{id}/leave")
    public void leave(@DestinationVariable Long id, Principal principal) {
        dueloLiveService.abandonar(id, usuario(principal));
    }

    @MessageMapping("/duelo/{id}/vote-raw")
    public void voteRaw(@DestinationVariable Long id, Map<String, String> payload, Principal principal) {
        // Parse defensivo: un frame STOMP con choice nulo o fuera del enum
        // lanzaba NPE/IllegalArgument crudo desde valueOf.
        String bruto = payload == null ? null : payload.get("choice");
        DueloLiveChoice choice;
        try {
            choice = DueloLiveChoice.valueOf(bruto);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("choice inválido: " + bruto);
        }
        dueloLiveService.votar(id, usuario(principal), choice);
    }

    private static Usuario usuario(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof Usuario usuario) {
            return usuario;
        }
        throw new IllegalArgumentException("Mensaje WS PvP requiere JWT válido");
    }
}
