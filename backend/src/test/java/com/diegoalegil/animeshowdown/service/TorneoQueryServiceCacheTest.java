package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import com.diegoalegil.animeshowdown.config.CacheConfig;
import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = TorneoQueryServiceCacheTest.Config.class)
class TorneoQueryServiceCacheTest {

    @Autowired
    private TorneoQueryService queryService;

    @Autowired
    private TorneoRepository torneoRepository;

    @Autowired
    private EnfrentamientoRepository enfrentamientoRepository;

    @Autowired
    private VotoRepository votoRepository;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        reset(torneoRepository, enfrentamientoRepository, votoRepository);
        cache().clear();
    }

    @Test
    void cacheaListadoPublicoDeTorneos() {
        Torneo torneo = new Torneo("torneo-cache", "Torneo cache", "Listado cacheable");
        torneo.setId(1L);
        torneo.setEstado(EstadoTorneo.SCHEDULED);
        torneo.setEstadoRevision(EstadoRevision.NO_APLICA);
        torneo.setPublico(true);

        when(torneoRepository.findVisiblesPublico()).thenReturn(List.of(torneo));
        when(enfrentamientoRepository.findByTorneoIdInOrdered(List.of(1L))).thenReturn(List.of());
        when(votoRepository.contarVotosPorTorneoDesde(any(LocalDateTime.class))).thenReturn(List.of());

        var primero = queryService.listarResumenes();
        var segundo = queryService.listarResumenes();

        assertThat(segundo).isSameAs(primero);
        assertThat(cache().get("publico")).isNotNull();
        verify(torneoRepository, times(1)).findVisiblesPublico();
        verify(enfrentamientoRepository, times(1)).findByTorneoIdInOrdered(List.of(1L));
        verify(votoRepository, times(1)).contarVotosPorTorneoDesde(any(LocalDateTime.class));
    }

    private Cache cache() {
        Cache cache = cacheManager.getCache("torneos-resumen");
        assertThat(cache).isNotNull();
        return cache;
    }

    @Configuration
    @EnableCaching
    @Import(CacheConfig.class)
    static class Config {

        @Bean
        TorneoQueryService torneoQueryService(
                TorneoRepository torneoRepository,
                EnfrentamientoRepository enfrentamientoRepository,
                VotoRepository votoRepository,
                Clock clock) {
            return new TorneoQueryService(torneoRepository, enfrentamientoRepository, votoRepository, clock);
        }

        @Bean
        TorneoRepository torneoRepository() {
            return mock(TorneoRepository.class);
        }

        @Bean
        EnfrentamientoRepository enfrentamientoRepository() {
            return mock(EnfrentamientoRepository.class);
        }

        @Bean
        VotoRepository votoRepository() {
            return mock(VotoRepository.class);
        }

        @Bean
        Clock clock() {
            return Clock.fixed(Instant.parse("2026-05-31T12:00:00Z"), ZoneOffset.UTC);
        }
    }
}
