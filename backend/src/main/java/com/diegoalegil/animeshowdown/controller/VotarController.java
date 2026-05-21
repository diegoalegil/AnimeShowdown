package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.DueloSugeridoDto;
import com.diegoalegil.animeshowdown.service.DueloSugeridoService;

@RestController
@RequestMapping("/api/votar")
public class VotarController {

    private final DueloSugeridoService dueloSugeridoService;

    public VotarController(DueloSugeridoService dueloSugeridoService) {
        this.dueloSugeridoService = dueloSugeridoService;
    }

    @GetMapping("/sugerir-duelo")
    public ResponseEntity<DueloSugeridoDto> sugerirDuelo() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(dueloSugeridoService.sugerir());
    }
}
