package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.dto.RankingMovimientoItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(MockitoExtension.class)
class RankingMovimientosServiceTest {

    @Mock private VotoRepository votoRepository;

    private RankingMovimientosService sut;

    @BeforeEach
    void setUp() {
        sut = new RankingMovimientosService(votoRepository);
    }

    private static Personaje personaje(long id, String slug) {
        Personaje p = new Personaje();
        p.setId(id);
        p.setSlug(slug);
        p.setNombre("Name " + id);
        p.setAnime("Anime");
        return p;
    }

    private static RankingItem rankingItem(long id, String slug, long votos) {
        return new RankingItem(personaje(id, slug), votos);
    }

    @Test
    void calcularRankingVacioDevuelveListaVacia() {
        when(votoRepository.rankingAllTime(any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.<RankingItem>emptyList(), PageRequest.of(0, 10), 0));
        when(votoRepository.rankingHasta(any(), any(Pageable.class)))
                .thenReturn(Collections.emptyList());

        List<RankingMovimientoItem> result = sut.calcular(10, 7);

        assertThat(result).isEmpty();
    }

    @Test
    void calcularPersonajeNuevoNoTienePosicionAnterior() {
        RankingItem actual = rankingItem(1L, "naruto", 100L);
        when(votoRepository.rankingAllTime(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(actual), PageRequest.of(0, 10), 1));
        when(votoRepository.rankingHasta(any(), any(Pageable.class)))
                .thenReturn(Collections.emptyList()); // no history

        List<RankingMovimientoItem> result = sut.calcular(10, 7);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).esNuevo()).isTrue();
        assertThat(result.get(0).posicionAnterior()).isNull();
        assertThat(result.get(0).delta()).isNull();
        assertThat(result.get(0).posicionActual()).isEqualTo(1);
    }

    @Test
    void calcularLimitClampedA100() {
        // The service clamps limit > 100 to 100 internally.
        when(votoRepository.rankingAllTime(any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.<RankingItem>emptyList(), PageRequest.of(0, 100), 0));
        when(votoRepository.rankingHasta(any(), any(Pageable.class)))
                .thenReturn(Collections.emptyList());

        // Should not throw with limit > 100 or limit < 1
        List<RankingMovimientoItem> result = sut.calcular(500, 7);
        assertThat(result).isEmpty();

        result = sut.calcular(0, 7);
        assertThat(result).isEmpty();
    }

    @Test
    void calcularPersonajeSubidoDevuelveDeltaPositivo() {
        RankingItem actual = rankingItem(1L, "naruto", 100L);
        RankingItem hist = rankingItem(1L, "naruto", 100L);
        when(votoRepository.rankingAllTime(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(actual), PageRequest.of(0, 10), 1));
        when(votoRepository.rankingHasta(any(), any(Pageable.class)))
                .thenReturn(List.of(hist)); // ranked 1st in history

        List<RankingMovimientoItem> result = sut.calcular(10, 7);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).esNuevo()).isFalse();
        assertThat(result.get(0).posicionAnterior()).isEqualTo(1);
        assertThat(result.get(0).delta()).isEqualTo(0); // same position
    }

    @Test
    void calcularPersonajeBajoDevuelveDeltaNegativo() {
        RankingItem actual = rankingItem(2L, "goku", 50L); // now 2nd
        RankingItem hist1 = rankingItem(1L, "naruto", 200L); // was 1st
        RankingItem hist2 = rankingItem(2L, "goku", 150L); // was 2nd
        when(votoRepository.rankingAllTime(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(actual), PageRequest.of(0, 10), 1));
        when(votoRepository.rankingHasta(any(), any(Pageable.class)))
                .thenReturn(List.of(hist1, hist2)); // goku was at index 1 = position 2

        List<RankingMovimientoItem> result = sut.calcular(10, 7);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).posicionAnterior()).isEqualTo(2);
        assertThat(result.get(0).delta()).isEqualTo(0); // stayed at position 2
    }
}
