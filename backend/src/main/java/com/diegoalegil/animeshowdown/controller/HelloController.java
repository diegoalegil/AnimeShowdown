package com.diegoalegil.animeshowdown.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import com.diegoalegil.animeshowdown.dto.SaludoResponse;

@RestController
@RequestMapping("/api")
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hola, AnimeShowdown esta vivo!!!";
    }

    @GetMapping("/saludar")
    public SaludoResponse saludar(@RequestParam(defaultValue = "visitante") String nombre) {
        return new SaludoResponse(
                "Hola, " + nombre,
                "Bienvenido a AnimeShowdown.");
    }

}
