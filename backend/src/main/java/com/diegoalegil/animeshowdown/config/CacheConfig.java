package com.diegoalegil.animeshowdown.config;

import java.time.Duration;
import java.util.List;

import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * CacheManager Caffeine con TTLs específicos por cache.
 *
 * Antes la configuración vivía en application.properties con un único
 * `spring.cache.caffeine.spec` global. Eso no servía para OG images
 * (queremos 7 días) ni para nada que necesite TTLs distintos. El plan v2
 * §1.2 pide cache 7 días para `og-personaje` y `og-torneo`; el cache
 * Jikan ya existente vive 1 hora.
 *
 * Caches definidas aquí:
 *   - jikan-top-characters: 1h, 128 entradas. Imports Jikan.
 *   - og-personaje: 7 días, 500 entradas. PNG 1200x630 generados.
 *   - og-torneo: 7 días, 50 entradas. PNG de torneos.
 *
 * Definir el bean CacheManager explícitamente sobrescribe la
 * autoconfiguración Spring Boot — las properties `spring.cache.*` ya
 * no aplican.
 */
@Configuration
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "caffeine", matchIfMissing = true)
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(List.of(
                buildCache("jikan-top-characters", Duration.ofHours(1), 128),
                buildCache("og-personaje", Duration.ofDays(7), 500),
                buildCache("og-torneo", Duration.ofDays(7), 50),
                // El catálogo de personajes apenas cambia (solo cuando admin
                // importa o el seed corre). TTL 5min ahorra ~95% de hits a
                // Postgres en horas pico sin que el usuario note staleness.
                buildCache("personajes-listado", Duration.ofMinutes(5), 16),
                // Catálogo público mínimo para frontend y sitemap. TTL 1h
                // porque solo cambia con seed/admin; además emite ETag.
                buildCache("personajes-catalogo", Duration.ofHours(1), 16),
                // Autocomplete server-side. Key q+limit; TTL corto para no
                // retener demasiadas combinaciones raras.
                buildCache("personajes-busqueda", Duration.ofMinutes(10), 512),
                buildCache("personajes-individual", Duration.ofMinutes(5), 2000),
                // Similares cross-anime por slug. Estable entre votos (la
                // similitud por votos casi no se mueve a escala minuto). Key
                // compuesta slug+limit, max ~3000.
                buildCache("personajes-similares", Duration.ofMinutes(5), 3000),
                // Ranking actual con deltas vs hace N días. Pesado (dos
                // queries de COUNT con GROUP BY); cache 1min.
                buildCache("ranking-movimientos", Duration.ofMinutes(1), 64),
                // Time machine ELO por personaje. La curva del pasado no
                // cambia (solo extiende al cierre del día); cache largo 1h.
                buildCache("personaje-elo-history", Duration.ofHours(1), 1500),
                // Mapeo nombre+anime → mal_id resuelto contra Jikan
                // /characters?q=. Es prácticamente inmutable; TTL 30d para
                // cubrir el catálogo entero con un solo barrido inicial.
                buildCache("jikan-character-malid", Duration.ofDays(30), 2000),
                // URLs de /characters/{mal_id}/pictures. Las imágenes
                // adicionales de un personaje cambian rara vez; TTL 7d.
                buildCache("jikan-character-pictures", Duration.ofDays(7), 2000),
                // Clasificador B&W vs color por URL de imagen. Una imagen
                // dada no cambia de naturaleza, así que TTL muy largo
                // (30d) basta para nunca re-descargar la misma URL en una
                // misma semana operativa. maxSize alto porque cubrimos
                // hasta ~12000 URLs (~1052 personajes × 12 pictures).
                buildCache("jikan-image-is-color", Duration.ofDays(30), 15000)));
        return manager;
    }

    private CaffeineCache buildCache(String name, Duration ttl, long maxSize) {
        return new CaffeineCache(
                name,
                Caffeine.newBuilder()
                        .maximumSize(maxSize)
                        .expireAfterWrite(ttl)
                        .recordStats()
                        .build());
    }
}
