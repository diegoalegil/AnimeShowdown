package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import com.diegoalegil.animeshowdown.dto.CartaCatalogoItem;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = CartaLecturaCacheServiceTest.Config.class)
class CartaLecturaCacheServiceTest {

    @Autowired private CartaLecturaCacheService sut;
    @Autowired private CartaRepository cartaRepository;
    @Autowired private PersonajeVotoScoreRepository votoScoreRepository;
    @Autowired private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        reset(cartaRepository, votoScoreRepository);
        cache("cartas-catalogo").clear();
        cache("cartas-votos-score").clear();
    }

    @Test
    void cacheaCatalogoGlobalSinReconsultarBaseDeDatos() {
        CartaCatalogoItem item = new CartaCatalogoItem(
                100L, 10L, "goku", "Goku", "Dragon Ball", "/img/goku.webp",
                null, RarezaCarta.SSR, false, "", null);
        when(cartaRepository.findCatalogoItems()).thenReturn(List.of(item));

        var primera = sut.catalogo();
        var segunda = sut.catalogo();

        assertThat(segunda).isSameAs(primera);
        assertThat(cache("cartas-catalogo").get("global")).isNotNull();
        verify(cartaRepository, times(1)).findCatalogoItems();
    }

    @Test
    void cacheaScoresGlobalesDeVotos() {
        when(votoScoreRepository.findAllScores())
                .thenReturn(List.<Object[]>of(new Object[]{10L, 0.5d}));

        var primera = sut.votosPorPersonaje();
        var segunda = sut.votosPorPersonaje();

        assertThat(segunda).isSameAs(primera);
        assertThat(segunda).containsEntry(10L, 1L);
        assertThat(cache("cartas-votos-score").get("global")).isNotNull();
        verify(votoScoreRepository, times(1)).findAllScores();
    }

    private Cache cache(String name) {
        Cache cache = cacheManager.getCache(name);
        assertThat(cache).isNotNull();
        return cache;
    }

    @Configuration
    @EnableCaching
    @Import({CacheConfig.class, CartaLecturaCacheService.class})
    static class Config {

        @Bean
        CartaRepository cartaRepository() {
            return mock(CartaRepository.class);
        }

        @Bean
        PersonajeVotoScoreRepository votoScoreRepository() {
            return mock(PersonajeVotoScoreRepository.class);
        }
    }
}
