package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

/**
 * "Arena" permanente (V66): un torneo-sistema sin bracket cuyo pool de duelos
 * del roster se vota como cualquier match → los votos cuentan para el ranking.
 *
 * <p>Resuelve el problema de la repetición: el pool es grande y se mantiene
 * fresco en background — los duelos que maduran (≥ umbral de votos) se cierran
 * con ganador (salen del pool) y se reponen con parejas nuevas equilibradas por
 * score. Como cada votante excluye los que ya votó (NOT EXISTS en /siguientes),
 * el voto es prácticamente infinito sin repetir.
 *
 * <p>El emparejado toma una muestra aleatoria del roster completo, la ordena por
 * score materializado (personaje_voto_score) y empareja adyacentes → rivales de
 * nivel similar (ELO-balanced) con variedad de todo el catálogo.
 *
 * <p>El auto-avance de torneos IGNORA la Arena (no hay rondas): ver el guard en
 * {@code TorneoAutoAdvanceService.avanzarSiProcede}.
 */
@Service
public class ArenaService {

    private static final Logger log = LoggerFactory.getLogger(ArenaService.class);
    public static final String ARENA_SLUG = "arena";

    private final TorneoRepository torneoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final PersonajeRepository personajeRepository;
    private final PersonajeVotoScoreRepository personajeVotoScoreRepository;
    private final JdbcTemplate jdbcTemplate;
    private final int poolTarget;
    private final double resolveThreshold;
    private final int maxPorTick;

    public ArenaService(
            TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            PersonajeRepository personajeRepository,
            PersonajeVotoScoreRepository personajeVotoScoreRepository,
            JdbcTemplate jdbcTemplate,
            @Value("${app.arena.pool-target:200}") int poolTarget,
            @Value("${app.arena.resolve-threshold:50}") double resolveThreshold,
            @Value("${app.arena.max-por-tick:80}") int maxPorTick) {
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.personajeRepository = personajeRepository;
        this.personajeVotoScoreRepository = personajeVotoScoreRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.poolTarget = Math.max(2, poolTarget);
        this.resolveThreshold = Math.max(1.0, resolveThreshold);
        this.maxPorTick = Math.max(1, maxPorTick);
    }

    /** Find-or-create del torneo Arena permanente (idempotente). */
    @Transactional
    public Torneo ensureArena() {
        return torneoRepository.findBySlug(ARENA_SLUG).orElseGet(() -> {
            Torneo arena = new Torneo(ARENA_SLUG, "Arena", "Duelos libres de todo el roster");
            arena.setEstado(EstadoTorneo.IN_PROGRESS);
            arena.setEsArena(true);
            arena.setPublico(false); // no aparece en /torneos; es el backend del votar
            try {
                return torneoRepository.save(arena);
            } catch (DataIntegrityViolationException e) {
                // Carrera en el primer arranque: el UNIQUE de slug lo blinda.
                return torneoRepository.findBySlug(ARENA_SLUG).orElseThrow(() -> e);
            }
        });
    }

    /**
     * Tic de mantenimiento (lo llama {@code ArenaJob} en background): resuelve
     * los duelos maduros y repone el pool. NO corre en el hot path del voto.
     */
    @Transactional
    public void mantener() {
        Torneo arena = ensureArena();
        int resueltos = resolverMaduros(arena);
        int generados = reponerPool(arena);
        if (resueltos > 0 || generados > 0) {
            log.info("Arena: {} duelos resueltos, {} generados (pool objetivo={})",
                    resueltos, generados, poolTarget);
        }
    }

    /** Cierra los duelos abiertos con votos suficientes; gana el de más score. */
    private int resolverMaduros(Torneo arena) {
        List<Enfrentamiento> abiertos = enfrentamientoRepository.findByTorneoAndGanadorIsNull(arena);
        if (abiertos.isEmpty()) {
            return 0;
        }
        // Score por (enfrentamiento, personaje) de los duelos abiertos de la Arena.
        Map<Long, Double> totalPorEnf = new HashMap<>();
        Map<Long, Long> ganadorPorEnf = new HashMap<>();
        Map<Long, Double> mejorScorePorEnf = new HashMap<>();
        // ORDER BY determinista: sin él, en un empate de score ganaba la primera
        // fila que devolviera el motor (arbitrario, podía variar entre réplicas).
        // Con score DESC + personaje_id ASC, la primera fila por enfrentamiento es
        // el ganador estable (a igual score, el de menor personaje_id).
        jdbcTemplate.query("""
                SELECT s.enfrentamiento_id AS enf, s.personaje_id AS per, s.votos_score AS score
                FROM voto_enfrentamiento_stats s
                JOIN enfrentamientos e ON e.id = s.enfrentamiento_id
                WHERE e.torneo_id = ? AND e.ganador_id IS NULL
                ORDER BY s.enfrentamiento_id ASC, s.votos_score DESC, s.personaje_id ASC
                """, rs -> {
            long enf = rs.getLong("enf");
            long per = rs.getLong("per");
            double score = rs.getDouble("score");
            totalPorEnf.merge(enf, score, Double::sum);
            if (score > mejorScorePorEnf.getOrDefault(enf, -1.0)) {
                mejorScorePorEnf.put(enf, score);
                ganadorPorEnf.put(enf, per);
            }
        }, arena.getId());

        int resueltos = 0;
        for (Enfrentamiento enf : abiertos) {
            Double total = totalPorEnf.get(enf.getId());
            Long ganadorId = ganadorPorEnf.get(enf.getId());
            if (total == null || total < resolveThreshold || ganadorId == null) {
                continue;
            }
            enf.setGanador(personajeRepository.getReferenceById(ganadorId));
            enfrentamientoRepository.save(enf);
            resueltos++;
        }
        return resueltos;
    }

    /** Repone el pool de duelos abiertos hasta el objetivo con parejas nuevas. */
    private int reponerPool(Torneo arena) {
        long abiertos = enfrentamientoRepository.countByTorneoAndGanadorIsNull(arena);
        int faltan = (int) Math.min(maxPorTick, poolTarget - abiertos);
        if (faltan <= 0) {
            return 0;
        }

        // Muestra aleatoria del roster (≈ 2 por pareja + margen) y sus scores.
        int tamMuestra = Math.min(faltan * 2 + 20, 1200);
        List<Personaje> muestra = new ArrayList<>(personajeRepository.findRandom(tamMuestra));
        if (muestra.size() < 2) {
            return 0;
        }
        Map<Long, Double> score = new HashMap<>();
        personajeVotoScoreRepository.findAllById(
                muestra.stream().map(Personaje::getId).toList())
                .forEach(s -> score.put(s.getPersonajeId(), s.getVotosScore()));
        // Ordena por score → emparejar adyacentes = rivales de nivel similar.
        muestra.sort(Comparator.comparingDouble(p -> score.getOrDefault(p.getId(), 0.0)));

        // Pares ya abiertos (normalizado minId:maxId) para no duplicar duelos.
        Set<String> paresAbiertos = new HashSet<>();
        for (Enfrentamiento e : enfrentamientoRepository.findByTorneoAndGanadorIsNull(arena)) {
            if (e.getPersonaje1() != null && e.getPersonaje2() != null) {
                paresAbiertos.add(parKey(e.getPersonaje1().getId(), e.getPersonaje2().getId()));
            }
        }

        List<Enfrentamiento> nuevos = new ArrayList<>();
        for (int i = 0; i + 1 < muestra.size() && nuevos.size() < faltan; i += 2) {
            Personaje a = muestra.get(i);
            Personaje b = muestra.get(i + 1);
            String key = parKey(a.getId(), b.getId());
            if (a.getId().equals(b.getId()) || !paresAbiertos.add(key)) {
                continue;
            }
            nuevos.add(new Enfrentamiento(arena, a, b));
        }
        if (!nuevos.isEmpty()) {
            enfrentamientoRepository.saveAll(nuevos);
        }
        return nuevos.size();
    }

    private static String parKey(Long a, Long b) {
        return a <= b ? a + ":" + b : b + ":" + a;
    }
}
