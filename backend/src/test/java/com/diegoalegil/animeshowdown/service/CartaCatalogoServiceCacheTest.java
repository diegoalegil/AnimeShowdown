package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
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
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = CartaCatalogoServiceCacheTest.Config.class)
class CartaCatalogoServiceCacheTest {

    @Autowired private CartaCatalogoService sut;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private CartaRepository cartaRepository;
    @Autowired private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        reset(personajeRepository, cartaRepository);
        cache().clear();
    }

    @Test
    void sincronizarDesdePersonajesInvalidaCatalogoCacheado() {
        cache().put("global", List.of("stale"));
        when(personajeRepository.findAll()).thenReturn(List.of());
        when(cartaRepository.findPersonajeIdsByRareza(RarezaCarta.SSR)).thenReturn(List.of());

        sut.sincronizarDesdePersonajes();

        assertThat(cache().get("global")).isNull();
    }

    private Cache cache() {
        Cache cache = cacheManager.getCache("cartas-catalogo");
        assertThat(cache).isNotNull();
        return cache;
    }

    @Configuration
    @EnableCaching
    @Import({CacheConfig.class, CartaCatalogoService.class})
    static class Config {

        @Bean
        PersonajeRepository personajeRepository() {
            return mock(PersonajeRepository.class);
        }

        @Bean
        CartaRepository cartaRepository() {
            return mock(CartaRepository.class);
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }
}
