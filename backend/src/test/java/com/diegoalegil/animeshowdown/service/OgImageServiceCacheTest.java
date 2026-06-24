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
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.TierListRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * La clave de @Cacheable de renderAnime se NORMALIZA con la misma slugify que
 * usa el cuerpo. Antes la clave era el slug crudo (#slug): "Naruto" y "naruto"
 * fragmentaban el cache en dos entradas para el MISMO OG. Aquí se verifica que
 * dos slugs equivalentes (distinto case) colapsan a una sola entrada — y que el
 * SpEL T(SlugUtil).slugify(#slug) resuelve en runtime (un typo de ruta no falla
 * al compilar, falla al invocar el proxy).
 */
@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = OgImageServiceCacheTest.Config.class)
class OgImageServiceCacheTest {

    @Autowired private OgImageService sut;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        reset(personajeRepository);
        cache().clear();
    }

    @Test
    void claveDeAnimeColapsaPorSlugIndependienteDelCase() {
        // Lista vacía → renderAnime cae al fallback (bytes no-null) sin tocar red.
        when(personajeRepository.findDistinctAnimes()).thenReturn(List.of());

        byte[] primera = sut.renderAnime("naruto");
        byte[] segunda = sut.renderAnime("NARUTO");

        assertThat(primera).isNotEmpty();
        assertThat(segunda).isNotEmpty();

        // La 2ª llamada (mismo slug, distinto case) golpea cache: el cuerpo NO
        // se re-ejecuta, así que el repositorio se consulta una sola vez. Con la
        // clave cruda anterior serían dos entradas y dos consultas.
        verify(personajeRepository, times(1)).findDistinctAnimes();

        // Una única entrada cacheada, bajo la clave ya slugificada.
        assertThat(cache().get("naruto")).isNotNull();
    }

    @Test
    void claveDeDueloUsaSeparadorQueNoColisionaConGuiones() {
        // Bajo el separador viejo '-vs-', ('x-vs','y') y ('x','vs-y') colapsaban a
        // la misma clave 'x-vs-vs-y'. Con '|' (imposible en un slug) son distintas.
        when(personajeRepository.findBySlug(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(java.util.Optional.empty());

        sut.renderDuelo("x-vs", "y");  // clave "x-vs|y"
        sut.renderDuelo("x", "vs-y");  // clave "x|vs-y" (distinta → cache miss)

        // Si colisionaran (separador viejo) la 2ª sería cache hit y el cuerpo NO
        // consultaría "x". Que se consulte prueba que son entradas separadas.
        verify(personajeRepository).findBySlug("x");
        assertThat(dueloCache().get("x-vs|y")).isNotNull();
        assertThat(dueloCache().get("x|vs-y")).isNotNull();
    }

    private Cache cache() {
        Cache cache = cacheManager.getCache("og-anime");
        assertThat(cache).isNotNull();
        return cache;
    }

    private Cache dueloCache() {
        Cache cache = cacheManager.getCache("og-duelo");
        assertThat(cache).isNotNull();
        return cache;
    }

    @Configuration
    @EnableCaching
    @Import(CacheConfig.class)
    static class Config {

        @Bean
        PersonajeRepository personajeRepository() {
            return mock(PersonajeRepository.class);
        }

        @Bean
        TorneoRepository torneoRepository() {
            return mock(TorneoRepository.class);
        }

        @Bean
        VotoRepository votoRepository() {
            return mock(VotoRepository.class);
        }

        @Bean
        UsuarioRepository usuarioRepository() {
            return mock(UsuarioRepository.class);
        }

        @Bean
        SeguidorRepository seguidorRepository() {
            return mock(SeguidorRepository.class);
        }

        @Bean
        TierListRepository tierListRepository() {
            return mock(TierListRepository.class);
        }

        // Construido a mano para esquivar @Value("${app.images.base-url}"): el
        // proxy de cache se aplica igual porque es un bean Spring con @EnableCaching.
        @Bean
        OgImageService ogImageService(
                PersonajeRepository personajeRepository,
                TorneoRepository torneoRepository,
                VotoRepository votoRepository,
                UsuarioRepository usuarioRepository,
                SeguidorRepository seguidorRepository,
                TierListRepository tierListRepository) {
            return new OgImageService(
                    personajeRepository,
                    torneoRepository,
                    votoRepository,
                    usuarioRepository,
                    seguidorRepository,
                    tierListRepository,
                    "https://animeshowdown.test");
        }
    }
}
