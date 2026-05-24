package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.dto.RankingMovimientoItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Ranking actual con indicadores de movimiento ↑/↓/=/Nuevo
 *.
 *
 * <p>Estrategia: pedimos el ranking all-time top-N actual y el ranking
 * "histórico" truncado en (ahora - dias) días. Para cada personaje del
 * top-N actual buscamos su posición en el histórico:
 *   - presente: delta = anterior - actual (positivo = subió).
 *   - ausente: esNuevo=true, delta=null.
 *
 * <p>Pedimos el histórico al doble del top-N actual para que personajes
 * que estaban en, p.ej. la posición 80 y subieron al 30, puedan calcular
 * un delta. Si su posición histórica estaba más allá del top 2N, se
 * trata como "Nuevo" en el ranking visible.
 *
 * <p>Cache 1min por (limit, dias) — los counts cambian con votos pero
 * la utilidad del cache se nota en burst-traffic; el frontend hace
 * polling cada 30s, así que la mayoría de hits caen aquí.
 */
@Service
public class RankingMovimientosService {

    private static final int LIMITE_MAX = 100;

    private final VotoRepository votoRepository;

    public RankingMovimientosService(VotoRepository votoRepository) {
        this.votoRepository = votoRepository;
    }

    @Cacheable(value = "ranking-movimientos", key = "#limit + ':' + #dias")
    @Transactional(readOnly = true)
    public List<RankingMovimientoItem> calcular(int limit, int dias) {
        int n = Math.min(LIMITE_MAX, Math.max(1, limit));
        int diasSane = Math.max(1, dias);

        List<RankingItem> actuales = votoRepository.rankingAllTime(
                PageRequest.of(0, n)).getContent();
        LocalDateTime corte = LocalDateTime.now().minusDays(diasSane);
        // Pedimos 2N del histórico para tener margen al detectar nuevos.
        List<RankingItem> historico = votoRepository.rankingHasta(
                corte, PageRequest.of(0, n * 2));

        Map<Long, Integer> posicionHistorica = new HashMap<>();
        for (int i = 0; i < historico.size(); i++) {
            Personaje p = historico.get(i).getPersonaje();
            if (p != null) posicionHistorica.put(p.getId(), i + 1);
        }

        List<RankingMovimientoItem> out = new ArrayList<>(actuales.size());
        for (int i = 0; i < actuales.size(); i++) {
            Personaje p = actuales.get(i).getPersonaje();
            if (p == null) continue;
            int posActual = i + 1;
            Integer posAnterior = posicionHistorica.get(p.getId());
            Integer delta = posAnterior != null ? posAnterior - posActual : null;
            boolean esNuevo = posAnterior == null;
            out.add(new RankingMovimientoItem(
                    p.getId(),
                    p.getSlug(),
                    p.getNombre(),
                    p.getAnime(),
                    p.getImagenUrl(),
                    actuales.get(i).getVotos(),
                    posActual,
                    posAnterior,
                    delta,
                    esNuevo));
        }
        return out;
    }
}
