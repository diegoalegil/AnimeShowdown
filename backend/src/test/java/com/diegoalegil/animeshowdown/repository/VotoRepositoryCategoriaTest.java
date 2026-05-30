package com.diegoalegil.animeshowdown.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Voto;

/**
 * Queries de ranking por intención de voto (feature #15) + la garantía
 * crítica de que el ranking GLOBAL sigue intacto: los votos con categoría
 * siguen contando en él (los GROUP BY globales no filtran por categoría).
 *
 * <p>Es {@code @SpringBootTest} (no {@code @DataJpaTest}) por consistencia con
 * el resto de la suite: el proyecto corre Flyway + ddl-auto=validate sobre H2
 * en perfil test, y {@code @DataJpaTest} reemplazaría el datasource saltándose
 * ese contrato.
 */
@SpringBootTest
@ActiveProfiles("test")
class VotoRepositoryCategoriaTest {

    @Autowired private VotoRepository votoRepository;
    @Autowired private PersonajeRepository personajeRepository;

    private final PageRequest top = PageRequest.of(0, 50);

    private Personaje nuevoPersonaje(String tag) {
        String s = tag + "_" + UUID.randomUUID().toString().substring(0, 8);
        return personajeRepository.save(new Personaje(
                s, s, "Cat QA " + s, "fixture", "/img/qa/" + s + ".webp"));
    }

    private Voto votoCon(Personaje p, String categoria, LocalDateTime fecha) {
        Voto v = new Voto(p);
        v.setCategoria(categoria);
        if (fecha != null) {
            v.setFecha(fecha);
        }
        return votoRepository.save(v);
    }

    @Test
    void rankingPorCategoriaFiltraYOrdenaSoloEsaCategoria() {
        Personaje a = nuevoPersonaje("cat_a");
        Personaje b = nuevoPersonaje("cat_b");
        // A: 2 votos "poder"; B: 1 voto "poder" → A debe ir antes que B.
        votoCon(a, "poder", null);
        votoCon(a, "poder", null);
        votoCon(b, "poder", null);
        // Ruido en otra categoría que NO debe contar en "poder".
        votoCon(b, "diseno", null);
        votoCon(b, "diseno", null);
        votoCon(b, "diseno", null);

        List<RankingItem> poder = votoRepository.rankingPorCategoria("poder", top);
        RankingItem itemA = buscar(poder, a.getId());
        RankingItem itemB = buscar(poder, b.getId());
        assertNotNull(itemA, "A debe aparecer en ranking de poder");
        assertNotNull(itemB, "B debe aparecer en ranking de poder");
        assertEquals(2L, itemA.getVotos(), "A tiene 2 votos de poder");
        assertEquals(1L, itemB.getVotos(), "B tiene 1 voto de poder (los 3 de diseno no cuentan)");
        assertTrue(indiceDe(poder, a.getId()) < indiceDe(poder, b.getId()),
                "A (2 poder) debe ordenarse antes que B (1 poder)");
    }

    @Test
    void rankingPorCategoriaDesdeAplicaVentanaTemporal() {
        Personaje a = nuevoPersonaje("cat_win");
        LocalDateTime ahora = LocalDateTime.now();
        votoCon(a, "carisma", ahora.minusDays(1));    // dentro de la ventana
        votoCon(a, "carisma", ahora.minusDays(100));  // fuera de la ventana

        List<RankingItem> mes = votoRepository.rankingPorCategoriaDesde(
                "carisma", ahora.minusDays(30), top);
        RankingItem itemA = buscar(mes, a.getId());
        assertNotNull(itemA, "A debe aparecer en el ranking mensual de carisma");
        assertEquals(1L, itemA.getVotos(),
                "Solo el voto dentro de los últimos 30 días debe contar");
    }

    @Test
    void categoriasConVotosListaSoloLasUsadasYNoNull() {
        Personaje a = nuevoPersonaje("cat_disp");
        votoCon(a, "favorito", null);
        votoCon(a, null, null); // sin categoría → no debe aparecer

        List<String> categorias = votoRepository.categoriasConVotos();
        assertTrue(categorias.contains("favorito"),
                "favorito (con votos) debe estar en la lista");
        assertTrue(categorias.stream().noneMatch(c -> c == null),
                "categoriasConVotos nunca devuelve null");
    }

    @Test
    void rankingGlobalSigueContandoVotosConCategoria() {
        // GARANTÍA "global unbroken": el ranking global NO filtra por categoría,
        // así que un personaje con votos categorizados + sin categoría suma
        // TODOS en el global. Personaje nuevo → sin votos previos, conteo exacto.
        Personaje a = nuevoPersonaje("cat_global");
        votoCon(a, "poder", null);     // categorizado
        votoCon(a, "mejor-villano", null); // categorizado
        votoCon(a, null, null);        // sin intención

        List<RankingItem> global = votoRepository.obtenerRanking();
        RankingItem itemA = buscar(global, a.getId());
        assertNotNull(itemA, "A debe aparecer en el ranking global");
        assertEquals(3L, itemA.getVotos(),
                "El global cuenta los 3 votos (2 categorizados + 1 sin categoría)");
        assertEquals(3.0, itemA.getPesoVotos(), 0.001,
                "El peso global suma los 3 votos registrados (1.0 cada uno)");
    }

    private RankingItem buscar(List<RankingItem> items, Long personajeId) {
        return items.stream()
                .filter(it -> personajeId.equals(it.getPersonaje().getId()))
                .findFirst()
                .orElse(null);
    }

    private int indiceDe(List<RankingItem> items, Long personajeId) {
        for (int i = 0; i < items.size(); i++) {
            if (personajeId.equals(items.get(i).getPersonaje().getId())) {
                return i;
            }
        }
        return Integer.MAX_VALUE;
    }
}
