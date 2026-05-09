package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.service.JikanService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final JikanService jikanService;

    public AdminController(JikanService jikanService) {
        this.jikanService = jikanService;
    }

    @PostMapping("/personajes/importar")
    public ResponseEntity<List<Personaje>> importarPersonajes(@RequestParam(defaultValue = "10") int cantidad) {
        List<Personaje> importados = jikanService.importarTopPersonajes(cantidad);
        return ResponseEntity.ok(importados);
    }
}
