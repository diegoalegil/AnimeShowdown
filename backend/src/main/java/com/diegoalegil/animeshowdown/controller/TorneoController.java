package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;


@RestController
@RequestMapping("/api/torneos")
public class TorneoController {

    private final TorneoRepository torneoRepository;

    public TorneoController(TorneoRepository torneoRepository) {
        this.torneoRepository = torneoRepository;
    }

    @GetMapping
    public List<Torneo> listarTodos() {
        return torneoRepository.findAll();
    }

    @PostMapping
    public Torneo crear(@RequestBody TorneoCrearRequest request){
        Torneo torneo = new Torneo(request.getNombre(), request.getDescripcion());
        return torneoRepository.save(torneo);
    }
    
}
