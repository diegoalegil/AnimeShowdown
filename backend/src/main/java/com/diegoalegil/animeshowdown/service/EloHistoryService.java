package com.diegoalegil.animeshowdown.service;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.EloHistoryPoint;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Time machine del ELO.
 *
 * <p>Como el "ELO" del proyecto es el conteo de votos del personaje
 * (no un ELO con K-factor), la serie temporal se reconstruye agrupando
 * votos por día y calculando el acumulado al cierre de cada uno.
 *
 * <p>No usamos tabla de snapshots (que habría requerido cron diario):
 * la query agrupa al vuelo desde {@code votos}. Cacheado 1h porque la
 * curva del pasado no cambia (solo se extiende). Si en un futuro hay
 * volumen masivo y el GROUP BY duele, migrar a snapshot diario.
 */
@Service
public class EloHistoryService {

    private static final int MAX_DIAS = 90;
    private static final int DEFAULT_DIAS = 30;

    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;

    public EloHistoryService(PersonajeRepository personajeRepository,
            VotoRepository votoRepository) {
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
    }

    @Cacheable(value = "personaje-elo-history", key = "#slug + ':' + #dias")
    @Transactional(readOnly = true)
    public List<EloHistoryPoint> historial(String slug, int dias) {
        int n = clamp(dias);
        Optional<Personaje> opt = personajeRepository.findBySlug(slug);
        if (opt.isEmpty()) return List.of();
        Personaje p = opt.get();

        LocalDate hoy = LocalDate.now();
        LocalDate desde = hoy.minusDays(n - 1L);

        // Votos diarios desde `desde` hasta hoy.
        Map<LocalDate, Long> porDia = new HashMap<>();
        for (Object[] fila : votoRepository.votosPorDiaDesde(
                p.getId(), desde.atStartOfDay())) {
            LocalDate fecha = toLocalDate(fila[0]);
            Long count = (Long) fila[1];
            if (fecha != null) porDia.put(fecha, count);
        }

        // Total actual al cierre de hoy.
        long totalActual = votoRepository.countNormalByPersonajeId(p.getId());

        // Reconstruimos hacia atrás: cierre de hoy = total. Cierre de ayer =
        // total - votos_de_hoy. Cierre de hace 2 días = anterior - votos_ayer.
        // Esto produce la serie con un punto por día (incluso días sin votos,
        // donde el acumulado se mantiene plano).
        List<EloHistoryPoint> puntos = new ArrayList<>(n);
        long acumulado = totalActual;
        for (int i = 0; i < n; i++) {
            LocalDate dia = hoy.minusDays(i);
            puntos.add(new EloHistoryPoint(dia, acumulado));
            // Para el día anterior: descontamos los votos del día actual.
            acumulado -= porDia.getOrDefault(dia, 0L);
        }
        // Vienen del más reciente al más antiguo; los queremos al revés
        // para que el frontend pinte X=tiempo ascendente.
        java.util.Collections.reverse(puntos);
        return puntos;
    }

    @Transactional(readOnly = true)
    public Map<String, List<EloHistoryPoint>> historialBatch(List<String> slugs, int dias) {
        Map<String, List<EloHistoryPoint>> out = new java.util.LinkedHashMap<>();
        if (slugs == null || slugs.isEmpty()) return out;
        slugs.stream()
                .filter(slug -> slug != null && !slug.isBlank())
                .map(String::trim)
                .distinct()
                .limit(25)
                .forEach(slug -> out.put(slug, historial(slug, dias)));
        return out;
    }

    private static LocalDate toLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate ld) return ld;
        if (value instanceof Date d) return d.toLocalDate();
        if (value instanceof java.time.LocalDateTime ldt) return ldt.toLocalDate();
        if (value instanceof CharSequence cs) {
            try { return LocalDate.parse(cs); }
            catch (Exception e) { return null; }
        }
        return null;
    }

    private int clamp(int dias) {
        if (dias <= 0) return DEFAULT_DIAS;
        return Math.min(dias, MAX_DIAS);
    }
}
