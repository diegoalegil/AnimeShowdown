package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.PrediccionCampeonRequest;
import com.diegoalegil.animeshowdown.dto.PrediccionDto;
import com.diegoalegil.animeshowdown.dto.PrediccionRequest;
import com.diegoalegil.animeshowdown.model.Prediccion;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.service.PrediccionService;

import jakarta.validation.Valid;

/**
 * Endpoints REST de predicciones.
 *
 * <ul>
 *   <li>{@code POST /api/predicciones} — autenticado. Crea o actualiza.</li>
 *   <li>{@code GET /api/predicciones/mias/torneo/{torneoId}} — autenticado.
 *       Mis predicciones de un torneo concreto.</li>
 *   <li>{@code GET /api/predicciones/leaderboard?dias=30&limit=10} —
 *       público. Top predictores del periodo.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/predicciones")
public class PrediccionController {

    private static final Logger log = LoggerFactory.getLogger(PrediccionController.class);

    private final PrediccionService prediccionService;
    private final TorneoRepository torneoRepository;

    public PrediccionController(PrediccionService prediccionService,
            TorneoRepository torneoRepository) {
        this.prediccionService = prediccionService;
        this.torneoRepository = torneoRepository;
    }

    @PostMapping
    public ResponseEntity<?> aplicar(@Valid @RequestBody PrediccionRequest req,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            Prediccion p = prediccionService.aplicar(usuario,
                    req.getEnfrentamientoId(), req.getPersonajePredichoId());
            return ResponseEntity.ok(PrediccionDto.from(p));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/campeon")
    public ResponseEntity<?> aplicarCampeon(@Valid @RequestBody PrediccionCampeonRequest req,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            Prediccion p = prediccionService.aplicarCampeon(usuario,
                    req.getTorneoId(), req.getPersonajePredichoId());
            return ResponseEntity.ok(PrediccionDto.from(p));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/mias/torneo/{torneoId}")
    public ResponseEntity<?> miasDelTorneo(@PathVariable Long torneoId,
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Torneo torneo = torneoRepository.findById(torneoId).orElse(null);
        if (torneo == null) return ResponseEntity.notFound().build();
        // mismo 404 que TorneoQueryService.findById
        // para torneos PENDIENTE/RECHAZADO. Antes este endpoint dejaba al
        // usuario consultar "mis predicciones" sobre un torneo en cola de
        // moderación, filtrando su existencia por id.
        if (torneo.getEstadoRevision() == com.diegoalegil.animeshowdown.model.EstadoRevision.PENDIENTE
                || torneo.getEstadoRevision() == com.diegoalegil.animeshowdown.model.EstadoRevision.RECHAZADO) {
            return ResponseEntity.notFound().build();
        }
        // El mapeo a DTO sucede dentro de la transacción del service para
        // que el acceso lazy a personajePredicho no falle al hidratar.
        List<PrediccionDto> mias = prediccionService.listarDtoPorUsuarioYTorneo(usuario, torneo);
        return ResponseEntity.ok(mias);
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<?> leaderboard(
            @RequestParam(defaultValue = "30") int dias,
            @RequestParam(defaultValue = "10") int limit) {
        int saneDias = Math.max(1, Math.min(dias, 365));
        int saneLimit = Math.max(1, Math.min(limit, 100));
        return ResponseEntity.ok(prediccionService.leaderboard(saneDias, saneLimit));
    }

    @GetMapping("/leaderboard/torneo/{torneoId}")
    public ResponseEntity<?> leaderboardTorneo(
            @PathVariable Long torneoId,
            @RequestParam(defaultValue = "10") int limit) {
        int saneLimit = Math.max(1, Math.min(limit, 100));
        try {
            return ResponseEntity.ok(prediccionService.leaderboardCampeonPorTorneo(torneoId, saneLimit));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
