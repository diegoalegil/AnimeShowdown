package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.FantasyDraftRequest;
import com.diegoalegil.animeshowdown.dto.FantasyEquipoDto;
import com.diegoalegil.animeshowdown.dto.FantasyLeaderboardEntryDto;
import com.diegoalegil.animeshowdown.dto.FantasyPersonajeDto;
import com.diegoalegil.animeshowdown.dto.FantasyResumenDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.FantasyShowdownService;

@RestController
@RequestMapping("/api/fantasy")
public class FantasyShowdownController {

    private final FantasyShowdownService fantasyService;

    public FantasyShowdownController(FantasyShowdownService fantasyService) {
        this.fantasyService = fantasyService;
    }

    @GetMapping("/me")
    public FantasyResumenDto miFantasy(@AuthenticationPrincipal Usuario usuario) {
        return fantasyService.resumen(usuario);
    }

    @GetMapping("/candidatos")
    public List<FantasyPersonajeDto> candidatos(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "80") int limit) {
        return fantasyService.candidatos(q, limit);
    }

    @PutMapping("/me/equipo")
    public FantasyEquipoDto guardarDraft(
            @AuthenticationPrincipal Usuario usuario,
            @RequestBody FantasyDraftRequest request) {
        return fantasyService.guardarDraft(usuario, request);
    }

    @PostMapping("/me/equipo/lock")
    public FantasyEquipoDto bloquear(@AuthenticationPrincipal Usuario usuario) {
        return fantasyService.bloquearEquipo(usuario);
    }

    @GetMapping("/leaderboard")
    public List<FantasyLeaderboardEntryDto> leaderboard(
            @RequestParam(required = false) String semanaIso,
            @RequestParam(defaultValue = "50") int limit) {
        return fantasyService.leaderboard(semanaIso, limit);
    }

}
