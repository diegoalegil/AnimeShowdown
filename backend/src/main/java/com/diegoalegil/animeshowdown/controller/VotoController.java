package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@RestController
@RequestMapping("/api/votos")
public class VotoController {

    private final VotoRepository votoRepository;

    public VotoController(VotoRepository votoRepository) {
        this.votoRepository = votoRepository;
    }

    @GetMapping("/ranking")
    public List<RankingItem> obtenerRanking() {
        return votoRepository.obtenerRanking();
    }

}
