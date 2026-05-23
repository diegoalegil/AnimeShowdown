package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.PersonajeSimilarDto;
import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Recomendaciones de personajes "más como X".
 *
 * <p>Fuente única de verdad para el ELO: el conteo de votos del personaje.
 * No usamos atributos extendidos (género, era, tropos…) porque están
 * bloqueados por el Bloque 15.
 *
 * <p>Estrategia:
 * <ol>
 *   <li>Filtramos personajes de animes DISTINTOS al target — la ficha
 *       ya tiene "Más personajes de X" para el mismo universo. Esta
 *       sección hace discovery cross-anime.</li>
 *   <li>Calculamos similitud por proximidad de votos:
 *       {@code 1 - |votos_target - votos_otro| / max(votos_target, votos_otro, 1)}.
 *       Va de 0 (extremos opuestos) a 1 (mismos votos).</li>
 *   <li>Tiebreaker estable: más votos primero. Garantiza que cuando
 *       target tiene 0 votos (catálogo grande sin engagement aún) salgan
 *       los más populares cross-anime, no random.</li>
 *   <li>Top N por (similitud desc, votos_otro desc, id asc).</li>
 * </ol>
 *
 * <p>Cache de 5min por slug porque los conteos de votos cambian poco a
 * escala minuto y la recomendación es estable. La cache invalida en cada
 * boot del backend; las invalidaciones explícitas no son críticas (la
 * lista solo se mueve cuando hay votos masivos al target o a similares).
 */
@Service
public class RecomendacionService {

    private static final int LIMITE_MAX = 24;
    private static final int LIMITE_DEFAULT = 8;

    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;

    public RecomendacionService(PersonajeRepository personajeRepository,
            VotoRepository votoRepository) {
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
    }

    /**
     * Devuelve los {@code limit} personajes más similares al target,
     * excluyendo personajes del mismo anime.
     *
     * @param slug  slug del personaje target
     * @param limit cantidad a devolver (1-{@value #LIMITE_MAX}; default {@value #LIMITE_DEFAULT})
     * @return lista ordenada por similitud desc; vacía si el slug no existe
     */
    @Cacheable(value = "personajes-similares", key = "#slug + ':' + #limit")
    @Transactional(readOnly = true)
    public List<PersonajeSimilarDto> similares(String slug, int limit) {
        int n = clampLimit(limit);
        Optional<Personaje> targetOpt = personajeRepository.findBySlug(slug);
        if (targetOpt.isEmpty()) return List.of();
        Personaje target = targetOpt.get();

        Map<Long, Long> votosPorPersonaje = cargarVotosPorPersonaje();
        long votosTarget = votosPorPersonaje.getOrDefault(target.getId(), 0L);

        List<Personaje> candidatos = personajeRepository.findAll();
        List<PersonajeSimilarDto> ranked = new ArrayList<>(candidatos.size());
        for (Personaje p : candidatos) {
            if (p.getId().equals(target.getId())) continue;
            if (p.getAnime().equals(target.getAnime())) continue; // cross-anime
            long votos = votosPorPersonaje.getOrDefault(p.getId(), 0L);
            double score = similitudPorVotos(votosTarget, votos);
            ranked.add(new PersonajeSimilarDto(
                    p.getId(), p.getSlug(), p.getNombre(), p.getAnime(),
                    p.getImagenUrl(), votos, score));
        }

        ranked.sort(
                Comparator
                        .comparingDouble(PersonajeSimilarDto::score).reversed()
                        .thenComparing(Comparator.comparingLong(PersonajeSimilarDto::votos).reversed())
                        .thenComparing(PersonajeSimilarDto::id));
        return ranked.subList(0, Math.min(n, ranked.size()));
    }

    /**
     * Similitud por proximidad de votos. Va de 0 (extremos) a 1 (mismos
     * votos). Si ambos personajes tienen 0 votos se consideran "iguales"
     * (similitud 1) — en ese caso el tiebreaker por votos absolutos
     * desempata por popularidad real.
     */
    private static double similitudPorVotos(long a, long b) {
        long maximo = Math.max(Math.max(a, b), 1);
        long delta = Math.abs(a - b);
        return 1.0 - (double) delta / maximo;
    }

    /**
     * Mapa {@code personajeId → votos}. Los personajes sin votos NO aparecen
     * en la respuesta de la query; el caller debe defaultear a 0.
     */
    private Map<Long, Long> cargarVotosPorPersonaje() {
        Map<Long, Long> out = new HashMap<>();
        for (RankingItem r : votoRepository.obtenerRanking()) {
            out.put(r.getPersonaje().getId(), r.getVotos());
        }
        return out;
    }

    private int clampLimit(int limit) {
        if (limit <= 0) return LIMITE_DEFAULT;
        return Math.min(limit, LIMITE_MAX);
    }
}
