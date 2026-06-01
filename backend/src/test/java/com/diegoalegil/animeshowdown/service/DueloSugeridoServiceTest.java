package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@ExtendWith(MockitoExtension.class)
class DueloSugeridoServiceTest {

    @Mock private PersonajeRepository personajeRepository;
    @Mock private AnimeShowdownMetrics metrics;

    @Test
    void cacheaPoolTopParaEvitarRecalcularAgregadoPorCadaRondaLive() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-31T12:00:00Z"), ZoneOffset.UTC);
        DueloSugeridoService service = new DueloSugeridoService(personajeRepository, metrics, clock);
        when(personajeRepository.topConPuntuacionYRecencia(any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(List.of(
                        item(1L, "goku", 30.0),
                        item(2L, "vegeta", 28.0),
                        item(3L, "luffy", 25.0)));

        assertThat(service.sugerir().personaje1().getId()).isNotNull();
        assertThat(service.sugerir().personaje2().getId()).isNotNull();

        verify(personajeRepository, times(1))
                .topConPuntuacionYRecencia(any(LocalDateTime.class), any(Pageable.class));
    }

    private static PersonajeScoreItem item(Long id, String slug, double votos) {
        return new PersonajeScoreItem(id, slug, slug, "Test", "/img/" + slug + ".webp", votos, 0.0);
    }
}
