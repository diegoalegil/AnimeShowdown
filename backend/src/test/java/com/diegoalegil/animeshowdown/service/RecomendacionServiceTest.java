package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.dto.PersonajeSimilarDto;
import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(MockitoExtension.class)
class RecomendacionServiceTest {

    @Mock private PersonajeRepository personajeRepository;
    @Mock private VotoRepository votoRepository;

    private RecomendacionService sut;
    private Personaje target;

    @BeforeEach
    void setUp() {
        sut = new RecomendacionService(personajeRepository, votoRepository);
        target = new Personaje("goku", "Goku", "Dragon Ball", "desc", "url");
        target.setId(1L);
    }

    @Test
    void similaresDevuelveVacioSiSlugNoExiste() {
        when(personajeRepository.findBySlug("no-existe")).thenReturn(java.util.Optional.empty());

        List<PersonajeSimilarDto> result = sut.similares("no-existe", 8);

        assertTrue(result.isEmpty());
    }

    @Test
    void similaresExcluyePersonajesDelMismoAnime() {
        when(personajeRepository.findBySlug("goku")).thenReturn(java.util.Optional.of(target));
        Personaje mismoAnime = new Personaje("vegeta", "Vegeta", "Dragon Ball", "desc", "url");
        mismoAnime.setId(2L);
        when(personajeRepository.findAll()).thenReturn(List.of(target, mismoAnime));
        when(votoRepository.obtenerRanking()).thenReturn(List.of());

        List<PersonajeSimilarDto> result = sut.similares("goku", 8);

        assertTrue(result.isEmpty());
    }

    @Test
    void similaresExcluyeElTargetMismo() {
        when(personajeRepository.findBySlug("goku")).thenReturn(java.util.Optional.of(target));
        Personaje otro = new Personaje("naruto", "Naruto", "Naruto", "desc", "url");
        otro.setId(2L);
        when(personajeRepository.findAll()).thenReturn(List.of(target, otro));
        when(votoRepository.obtenerRanking()).thenReturn(List.of());

        List<PersonajeSimilarDto> result = sut.similares("goku", 8);

        assertEquals(1, result.size());
        assertEquals("naruto", result.get(0).slug());
    }

    @Test
    void similaresOrdenaPorSimilitudDescYVotosDesc() {
        when(personajeRepository.findBySlug("goku")).thenReturn(java.util.Optional.of(target));
        Personaje naruto = new Personaje("naruto", "Naruto", "Naruto", "desc", "url");
        naruto.setId(2L);
        Personaje luffy = new Personaje("luffy", "Luffy", "One Piece", "desc", "url");
        luffy.setId(3L);
        when(personajeRepository.findAll()).thenReturn(List.of(target, naruto, luffy));
        when(votoRepository.obtenerRanking()).thenReturn(List.of(
                rankingItem(luffy, 100),
                rankingItem(naruto, 50)
        ));

        List<PersonajeSimilarDto> result = sut.similares("goku", 8);

        assertEquals(2, result.size());
        assertEquals("luffy", result.get(0).slug()); // más votos primero (same similarity since all 0 votes for target)
    }

    @Test
    void similaresAplicaLimiteCorrectamente() {
        when(personajeRepository.findBySlug("goku")).thenReturn(java.util.Optional.of(target));
        // Create many personajes with different animes
        java.util.ArrayList<Personaje> many = new java.util.ArrayList<>();
        for (int i = 0; i < 30; i++) {
            Personaje p = new Personaje("p" + i, "P" + i, "Anime" + i, "desc", "url");
            p.setId((long) (i + 10));
            many.add(p);
        }
        when(personajeRepository.findAll()).thenReturn(many);
        when(votoRepository.obtenerRanking()).thenReturn(List.of());

        List<PersonajeSimilarDto> result = sut.similares("goku", 5);

        assertEquals(5, result.size());
    }

    @Test
    void similaresDevuelveDefaultSiLimitCeroONegativo() {
        when(personajeRepository.findBySlug("goku")).thenReturn(java.util.Optional.of(target));
        when(personajeRepository.findAll()).thenReturn(List.of(target));
        when(votoRepository.obtenerRanking()).thenReturn(List.of());

        List<PersonajeSimilarDto> result = sut.similares("goku", 0);

        assertNotNull(result);
    }

    @Test
    void similaresDevuelveMax24AunqueLimitSeaMayor() {
        when(personajeRepository.findBySlug("goku")).thenReturn(java.util.Optional.of(target));
        java.util.ArrayList<Personaje> many = new java.util.ArrayList<>();
        for (int i = 0; i < 50; i++) {
            Personaje p = new Personaje("p" + i, "P" + i, "Anime" + i, "desc", "url");
            p.setId((long) (i + 10));
            many.add(p);
        }
        when(personajeRepository.findAll()).thenReturn(many);
        when(votoRepository.obtenerRanking()).thenReturn(List.of());

        List<PersonajeSimilarDto> result = sut.similares("goku", 999);

        assertEquals(24, result.size());
    }

    private static RankingItem rankingItem(Personaje p, long votos) {
        return new RankingItem(p, votos);
    }
}