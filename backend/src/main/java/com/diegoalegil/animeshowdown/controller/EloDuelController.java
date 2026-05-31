package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EloDuelGuessRequest;
import com.diegoalegil.animeshowdown.dto.EloDuelGuessResponse;
import com.diegoalegil.animeshowdown.dto.EloDuelRoundDto;
import com.diegoalegil.animeshowdown.service.EloDuelService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/games/elo-duel")
public class EloDuelController {

    private final EloDuelService eloDuelService;

    public EloDuelController(EloDuelService eloDuelService) {
        this.eloDuelService = eloDuelService;
    }

    @GetMapping("/round")
    public ResponseEntity<EloDuelRoundDto> round() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(eloDuelService.iniciarRonda());
    }

    @PostMapping("/guess")
    public ResponseEntity<EloDuelGuessResponse> guess(@Valid @RequestBody EloDuelGuessRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(eloDuelService.resolver(request));
    }
}
