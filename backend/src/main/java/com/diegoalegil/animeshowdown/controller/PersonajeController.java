package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@RestController
@RequestMapping("/api/personajes")
public class PersonajeController {

    private final PersonajeRepository personajeRepository;

    public PersonajeController(PersonajeRepository personajeRepository) {
        this.personajeRepository = personajeRepository;
    }

    @GetMapping
    public List<Personaje> listartodos(){
        return personajeRepository.findAll();
    }
}
