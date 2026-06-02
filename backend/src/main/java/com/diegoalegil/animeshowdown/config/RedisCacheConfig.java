package com.diegoalegil.animeshowdown.config;

import java.time.Duration;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;

@Configuration
@EnableCaching
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
public class RedisCacheConfig {

    private static RedisCacheConfiguration config(Duration ttl) {
        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(ttl)
                .computePrefixWith(cacheName -> "as:" + cacheName + "::");
    }

    @Bean
    RedisCacheManagerBuilderCustomizer animeShowdownRedisCacheCustomizer() {
        return builder -> builder
                .cacheDefaults(config(Duration.ofMinutes(1)))
                .withInitialCacheConfigurations(Map.ofEntries(
                        Map.entry("ranking-movimientos", config(Duration.ofMinutes(1))),
                        Map.entry("personajes-catalogo", config(Duration.ofHours(1))),
                        Map.entry("personajes-listado", config(Duration.ofHours(1))),
                        Map.entry("personajes-individual", config(Duration.ofMinutes(5))),
                        Map.entry("personajes-similares", config(Duration.ofMinutes(5))),
                        Map.entry("cartas-catalogo", config(Duration.ofMinutes(10))),
                        Map.entry("cartas-votos-score", config(Duration.ofSeconds(30))),
                        Map.entry("personaje-elo-history", config(Duration.ofHours(1))),
                        Map.entry("torneos-resumen", config(Duration.ofSeconds(30))),
                        Map.entry("og-personaje", config(Duration.ofDays(7))),
                        Map.entry("og-torneo", config(Duration.ofDays(7))),
                        Map.entry("og-ranking", config(Duration.ofDays(7))),
                        Map.entry("og-anime", config(Duration.ofDays(7))),
                        Map.entry("og-pvp", config(Duration.ofDays(7))),
                        Map.entry("og-duelo", config(Duration.ofDays(7))),
                        Map.entry("jikan-top-characters", config(Duration.ofHours(1))),
                        Map.entry("jikan-character-malid", config(Duration.ofDays(30))),
                        Map.entry("jikan-character-pictures", config(Duration.ofDays(7))),
                        Map.entry("jikan-image-is-color", config(Duration.ofDays(30)))));
    }
}
