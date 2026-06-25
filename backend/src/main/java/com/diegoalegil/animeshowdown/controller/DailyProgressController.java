package com.diegoalegil.animeshowdown.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.DailyProgressDto;
import com.diegoalegil.animeshowdown.dto.MigrarRachaRequest;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.DailyProgressService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Progreso diario y racha del usuario autenticado (server-side). Los votos se
 * registran solos vía evento; aquí el cliente lee el estado y reporta los pasos
 * que no pasan por el backend (jugar un daily, revisar el ranking).
 */
@RestController
@RequestMapping("/api/me/daily")
@Tag(name = "Misión diaria", description = "Progreso de la misión diaria y racha del usuario (server-side).")
public class DailyProgressController {

    private final DailyProgressService dailyProgressService;

    public DailyProgressController(DailyProgressService dailyProgressService) {
        this.dailyProgressService = dailyProgressService;
    }

    @GetMapping
    @Operation(summary = "Progreso diario y racha",
            description = "Estado de hoy (votos, juego, ranking, completado) y la racha actual/record.")
    public DailyProgressDto leer(@AuthenticationPrincipal Usuario usuario) {
        return dailyProgressService.leer(usuario.getId());
    }

    @PostMapping("/juego")
    @Operation(summary = "Marcar daily trial jugado",
            description = "Registra que el usuario completó un daily trial hoy (idempotente por día).")
    public DailyProgressDto marcarJuego(@AuthenticationPrincipal Usuario usuario) {
        return dailyProgressService.marcarJuego(usuario.getId());
    }

    @PostMapping("/ranking-visto")
    @Operation(summary = "Marcar ranking revisado",
            description = "Registra que el usuario revisó el ranking hoy (idempotente por día).")
    public DailyProgressDto marcarRankingVisto(@AuthenticationPrincipal Usuario usuario) {
        return dailyProgressService.marcarRankingVisto(usuario.getId());
    }

    @PostMapping("/migrar-racha")
    @Operation(summary = "Migrar la racha local al servidor (una vez)",
            description = "Siembra la racha de localStorage al servidor en el primer login tras la "
                    + "migración a server-side. Solo aplica si el servidor aún no tiene racha y la "
                    + "local está viva; capa el valor a la antigüedad de la cuenta. No-op en otro caso.")
    public DailyProgressDto migrarRacha(@AuthenticationPrincipal Usuario usuario,
            @Valid @RequestBody MigrarRachaRequest request) {
        java.time.LocalDateTime reg = usuario.getFechaRegistro();
        return dailyProgressService.migrarRacha(
                usuario.getId(),
                request.actual(),
                request.ultimaFechaCompletada(),
                reg == null ? null : reg.toLocalDate());
    }
}
