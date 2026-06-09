package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.DueloSugeridoDto;
import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;

@Service
public class DueloSugeridoService {

    private static final int TOP_POOL = 200;
    private static final int ELO_DIFF_MAX = 100;
    private static final int RECENT_EXCLUSION_SIZE = 50;
    private static final int MAX_ATTEMPTS = 200;
    private static final Duration POOL_TTL = Duration.ofSeconds(20);

    private final PersonajeScoreQueryService personajeScoreQueryService;
    private final AnimeShowdownMetrics metrics;
    private final Clock clock;
    private final ArrayDeque<Long> ultimosPersonajes = new ArrayDeque<>();
    private final Object poolCacheLock = new Object();
    private volatile CachedPool cachedPool;

    public DueloSugeridoService(
            PersonajeScoreQueryService personajeScoreQueryService,
            AnimeShowdownMetrics metrics,
            Clock clock) {
        this.personajeScoreQueryService = personajeScoreQueryService;
        this.metrics = metrics;
        this.clock = clock;
    }

    public DueloSugeridoDto sugerir() {
        List<PersonajeScoreItem> pool = poolReciente();

        if (pool.size() < 2) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No hay suficientes personajes para sugerir duelo");
        }

        DueloSugeridoDto dto = sugerirDesde(pool);
        metrics.dueloSugerido(dto.eloDiff());
        return dto;
    }

    private List<PersonajeScoreItem> poolReciente() {
        Instant now = clock.instant();
        CachedPool snapshot = cachedPool;
        if (snapshot != null && now.isBefore(snapshot.expiresAt())) {
            return snapshot.items();
        }
        synchronized (poolCacheLock) {
            snapshot = cachedPool;
            if (snapshot != null && now.isBefore(snapshot.expiresAt())) {
                return snapshot.items();
            }
            List<PersonajeScoreItem> fresh = List.copyOf(personajeScoreQueryService.topConPuntuacionYRecencia(
                    LocalDateTime.now(clock).minusHours(24),
                    TOP_POOL));
            cachedPool = new CachedPool(fresh, now.plus(POOL_TTL));
            return fresh;
        }
    }

    private DueloSugeridoDto sugerirDesde(List<PersonajeScoreItem> pool) {
        Set<Long> recientes = snapshotRecientes();
        List<PersonajeScoreItem> candidatosA = filtrarRecientesSiHayMargen(pool, recientes);

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            PersonajeScoreItem a = randomItem(candidatosA);
            List<PersonajeScoreItem> candidatosB = pool.stream()
                    .filter(b -> !b.id().equals(a.id()))
                    .filter(b -> Math.abs(b.eloEstimado() - a.eloEstimado()) <= ELO_DIFF_MAX)
                    .filter(b -> !recientes.contains(b.id()))
                    .sorted(Comparator
                            .comparingDouble(PersonajeScoreItem::recientes24h)
                            .thenComparing(PersonajeScoreItem::id))
                    .toList();

            if (!candidatosB.isEmpty()) {
                return construir(a, randomEntreMenosRecientes(candidatosB));
            }
        }

        return sugerirFallback(pool);
    }

    private DueloSugeridoDto sugerirFallback(List<PersonajeScoreItem> pool) {
        List<PersonajeScoreItem> ordenados = new ArrayList<>(pool);
        ordenados.sort(Comparator.comparingInt(PersonajeScoreItem::eloEstimado).reversed());

        for (int i = 0; i < ordenados.size(); i++) {
            PersonajeScoreItem a = ordenados.get(i);
            for (int j = i + 1; j < ordenados.size(); j++) {
                PersonajeScoreItem b = ordenados.get(j);
                if (Math.abs(a.eloEstimado() - b.eloEstimado()) <= ELO_DIFF_MAX) {
                    return construir(a, b);
                }
            }
        }

        PersonajeScoreItem a = ordenados.get(0);
        PersonajeScoreItem b = ordenados.get(1);
        return construir(a, b);
    }

    private DueloSugeridoDto construir(PersonajeScoreItem a, PersonajeScoreItem b) {
        int diff = Math.abs(a.eloEstimado() - b.eloEstimado());
        recordar(a.id());
        recordar(b.id());
        return new DueloSugeridoDto(
                a.toMiniDto(),
                b.toMiniDto(),
                a.eloEstimado(),
                b.eloEstimado(),
                diff,
                "top200_elo_estimado_menos_visto_24h");
    }

    private Set<Long> snapshotRecientes() {
        synchronized (ultimosPersonajes) {
            return new HashSet<>(ultimosPersonajes);
        }
    }

    private void recordar(Long id) {
        synchronized (ultimosPersonajes) {
            ultimosPersonajes.addLast(id);
            while (ultimosPersonajes.size() > RECENT_EXCLUSION_SIZE) {
                ultimosPersonajes.removeFirst();
            }
        }
    }

    private static List<PersonajeScoreItem> filtrarRecientesSiHayMargen(
            List<PersonajeScoreItem> pool,
            Set<Long> recientes) {
        List<PersonajeScoreItem> filtrados = pool.stream()
                .filter(p -> !recientes.contains(p.id()))
                .toList();
        return filtrados.size() >= 2 ? filtrados : pool;
    }

    private static PersonajeScoreItem randomItem(List<PersonajeScoreItem> items) {
        return items.get(ThreadLocalRandom.current().nextInt(items.size()));
    }

    private static PersonajeScoreItem randomEntreMenosRecientes(List<PersonajeScoreItem> candidatos) {
        double menorRecencia = candidatos.get(0).recientes24h();
        List<PersonajeScoreItem> mejores = candidatos.stream()
                .filter(p -> Double.compare(p.recientes24h(), menorRecencia) == 0)
                .toList();
        return randomItem(mejores);
    }

    private record CachedPool(List<PersonajeScoreItem> items, Instant expiresAt) {}
}
