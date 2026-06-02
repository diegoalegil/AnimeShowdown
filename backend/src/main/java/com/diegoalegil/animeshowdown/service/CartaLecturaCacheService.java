package com.diegoalegil.animeshowdown.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.CartaCatalogoItem;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;

@Service
public class CartaLecturaCacheService {

    private final CartaRepository cartaRepository;
    private final PersonajeVotoScoreRepository votoScoreRepository;

    public CartaLecturaCacheService(CartaRepository cartaRepository,
            PersonajeVotoScoreRepository votoScoreRepository) {
        this.cartaRepository = cartaRepository;
        this.votoScoreRepository = votoScoreRepository;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "cartas-catalogo", key = "'global'")
    public List<CartaCatalogoItem> catalogo() {
        return cartaRepository.findCatalogoItems();
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "cartas-votos-score", key = "'global'")
    public Map<Long, Long> votosPorPersonaje() {
        Map<Long, Long> votos = new HashMap<>();
        for (Object[] row : votoScoreRepository.findAllScores()) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            votos.put(((Number) row[0]).longValue(),
                    Math.max(0L, Math.round(((Number) row[1]).doubleValue())));
        }
        return votos;
    }
}
