package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.diegoalegil.animeshowdown.dto.StatusResponseDto;
import com.diegoalegil.animeshowdown.service.StatusService;

@RestController
@RequestMapping("/api/status")
@Tag(name = "Status", description = "Estado público del servicio y métricas operativas.")
public class StatusController {

    private final StatusService statusService;

    public StatusController(StatusService statusService) {
        this.statusService = statusService;
    }

    @GetMapping
    @Operation(summary = "Estado del servicio",
            description = "Resumen público de salud y métricas operativas, cacheado.")
    public ResponseEntity<StatusResponseDto> status() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(StatusService.PUBLIC_CACHE_TTL).cachePublic())
                .body(statusService.resumenPublico());
    }
}
