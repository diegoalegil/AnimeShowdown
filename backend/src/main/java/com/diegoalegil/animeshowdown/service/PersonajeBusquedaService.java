package com.diegoalegil.animeshowdown.service;

import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.dto.PersonajeBusquedaDto;
import com.diegoalegil.animeshowdown.dto.PersonajeCatalogoDto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@Service
public class PersonajeBusquedaService {

    private static final Duration SEARCH_INDEX_TTL = Duration.ofMinutes(5);

    private final PersonajeRepository personajeRepository;
    private final Clock clock;
    private volatile SearchIndex searchIndex;

    @Autowired
    public PersonajeBusquedaService(PersonajeRepository personajeRepository) {
        this(personajeRepository, Clock.systemUTC());
    }

    PersonajeBusquedaService(PersonajeRepository personajeRepository, Clock clock) {
        this.personajeRepository = personajeRepository;
        this.clock = clock;
    }

    public List<PersonajeBusquedaDto> buscar(String q, int limit) {
        String query = q == null ? "" : q.trim();
        if (query.length() < 2) {
            return List.of();
        }
        int saneLimit = Math.max(1, Math.min(25, limit));
        String normalizedQuery = normalizar(query);

        return currentIndex().stream()
                .map(entry -> entry.toResult(score(entry, normalizedQuery)))
                .filter(dto -> dto.getScore() > 0)
                .sorted(Comparator.comparingDouble(PersonajeBusquedaDto::getScore).reversed()
                        .thenComparing(PersonajeBusquedaDto::getNombre))
                .limit(saneLimit)
                .toList();
    }

    public void invalidateIndex() {
        searchIndex = null;
    }

    private List<IndexedPersonaje> currentIndex() {
        Instant now = clock.instant();
        SearchIndex cached = searchIndex;
        if (cached != null && now.isBefore(cached.expiresAt())) {
            return cached.entries();
        }

        synchronized (this) {
            cached = searchIndex;
            if (cached != null && now.isBefore(cached.expiresAt())) {
                return cached.entries();
            }
            List<IndexedPersonaje> entries = personajeRepository.findAllCatalogoOrderBySlug().stream()
                    .map(IndexedPersonaje::from)
                    .toList();
            searchIndex = new SearchIndex(entries, now.plus(SEARCH_INDEX_TTL));
            return entries;
        }
    }

    private double score(IndexedPersonaje entry, String q) {
        double score = 0;
        if (entry.nombreNormalizado().equals(q)) score += 100;
        if (entry.nombreNormalizado().startsWith(q)) score += 50;
        if (entry.nombreNormalizado().contains(q)) score += 25;
        if (entry.animeNormalizado().contains(q)) score += 15;
        if (entry.descripcionNormalizada().contains(q)) score += 5;
        return score;
    }

    private static String normalizar(String value) {
        if (value == null) return "";
        String lower = value.toLowerCase(Locale.ROOT);
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }

    private record SearchIndex(List<IndexedPersonaje> entries, Instant expiresAt) {
    }

    private record IndexedPersonaje(
            Long id,
            String slug,
            String nombre,
            String anime,
            String descripcion,
            String imagenUrl,
            String imagenColorDominante,
            String nombreNormalizado,
            String animeNormalizado,
            String descripcionNormalizada) {

        static IndexedPersonaje from(PersonajeCatalogoDto dto) {
            return new IndexedPersonaje(
                    dto.getId(),
                    dto.getSlug(),
                    dto.getNombre(),
                    dto.getAnime(),
                    dto.getDescripcion(),
                    dto.getImagenUrl(),
                    dto.getImagenColorDominante(),
                    normalizar(dto.getNombre()),
                    normalizar(dto.getAnime()),
                    normalizar(dto.getDescripcion()));
        }

        PersonajeBusquedaDto toResult(double score) {
            return new PersonajeBusquedaDto(
                    id,
                    slug,
                    nombre,
                    anime,
                    descripcion,
                    imagenUrl,
                    imagenColorDominante,
                    score);
        }
    }
}
