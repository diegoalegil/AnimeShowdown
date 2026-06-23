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
 *   - og-ranking / og-anime / og-pvp / og-duelo: 7 días. PNG compartibles
 *     para ranking, fichas de anime, PvP live y comparativas.
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
                buildCache("og-ranking", Duration.ofDays(7), 16),
                // OG de la portada (compartir animeshowdown.dev). Una sola
                // entrada; 7 días, se refresca solo con el redeploy o el TTL.
                buildCache("og-home", Duration.ofDays(7), 1),
                buildCache("og-anime", Duration.ofDays(7), 256),
                buildCache("og-pvp", Duration.ofDays(7), 8),
                buildCache("og-duelo", Duration.ofDays(7), 1000),
                buildCache("og-tier-list", Duration.ofDays(7), 1000),
                // OG de perfil de usuario (B7 §1b). Key = username; 7 días.
                // Se invalida sola por TTL; un cambio de avatar/bio tarda
                // como mucho una semana en reflejarse en el preview social.
                buildCache("og-usuario", Duration.ofDays(7), 1000),
                // Ranking all-time sin paginación. La query más caliente
                // (SectionPulso en home, staleTime:60s). TTL 30s para que
                // cambios menores (votos recientes) se reflejen rápido sin
                // saturar Postgres con cada request.
                buildCache("votos-ranking", Duration.ofSeconds(30), 8),
                // Ranking por categoría de intención de voto (feature #15). A
                // diferencia de las ramas materializadas, agrega en vivo con
                // GROUP BY sobre `votos` (caro); TTL 30s para absorber hits
                // repetidos del mismo combo categoria+periodo+limit.
                buildCache("votos-ranking-categoria", Duration.ofSeconds(30), 64),
                // El catálogo de personajes apenas cambia (solo cuando admin
                // importa o el seed corre). TTL 5min ahorra ~95% de hits a
                // Postgres en horas pico sin que el usuario note staleness.
                buildCache("personajes-listado", Duration.ofMinutes(5), 16),
                // Catálogo público mínimo para frontend y sitemap. TTL 1h
                // porque solo cambia con seed/admin; además emite ETag.
                buildCache("personajes-catalogo", Duration.ofHours(1), 16),
                buildCache("personajes-individual", Duration.ofMinutes(5), 2000),
                // Resumen "contra quién" del detalle de personaje. Agrega TODOS
                // los enfrentamientos decididos del personaje en memoria — caro
                // y recalculaba en cada visita. Cambia lento (solo con duelos
                // nuevos resueltos); TTL 5min. Key = slug, max ~2000.
                buildCache("personaje-matchups", Duration.ofMinutes(5), 2000),
                // Votos por periodo (ventana actual vs anterior + delta) del
                // detalle de personaje. Recalculaba dos COUNT por visita. Key =
                // slug+dias; TTL 1min (la ventana se mueve poco en 60s).
                buildCache("personaje-votos-periodo", Duration.ofMinutes(1), 3000),
                // Similares cross-anime por slug. Estable entre votos (la
                // similitud por votos casi no se mueve a escala minuto). Key
                // compuesta slug+limit, max ~3000.
                buildCache("personajes-similares", Duration.ofMinutes(5), 3000),
                // Colección de cartas: catálogo global raro de cambiar y score
                // global de votos corto. El estado de usuario se compone aparte.
                buildCache("cartas-catalogo", Duration.ofMinutes(10), 4),
                buildCache("cartas-votos-score", Duration.ofSeconds(30), 4),
                // Ranking actual con deltas vs hace N días. Pesado (dos
                // queries de COUNT con GROUP BY); cache 1min.
                buildCache("ranking-movimientos", Duration.ofMinutes(1), 64),
                // Top voters (leaderboard de engagement). GROUP BY full-table
                // sobre `votos` (la tabla más grande); sin caché pegaba a
                // Postgres en cada carga de /ranking. Key = periodo+limit (la
                // home usa unos pocos combos). TTL 1min: el leaderboard se
                // mueve lento y 60s de staleness es invisible.
                buildCache("votos-top-voters", Duration.ofMinutes(1), 64),
                // Categorías de intención con al menos un voto. Cambia muy
                // raramente (solo cuando una categoría nueva recibe su primer
                // voto); escaneaba `votos` en cada request del selector. TTL 5m.
                buildCache("votos-categorias-disponibles", Duration.ofMinutes(5), 4),
                // Listado público de torneos. El frontend/SW ya lo trata como
                // dato cacheable; cache corto para absorber hits repetidos sin
                // ocultar cambios de estado más de unos segundos.
                buildCache("torneos-resumen", Duration.ofSeconds(30), 4),
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
