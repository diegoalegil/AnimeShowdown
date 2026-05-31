package com.diegoalegil.animeshowdown.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
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
    @Autowired private EnfrentamientoRepository enfrentamientoRepository;
    @Autowired private TorneoRepository torneoRepository;
    @Autowired private UsuarioRepository usuarioRepository;

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
        assertEquals(2.0, itemA.getVotos(), 0.001, "A tiene 2 votos de poder");
        assertEquals(1.0, itemB.getVotos(), 0.001, "B tiene 1 voto de poder (los 3 de diseno no cuentan)");
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
        assertEquals(1.0, itemA.getVotos(), 0.001,
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
        assertEquals(3.0, itemA.getVotos(), 0.001,
                "El global cuenta los 3 votos (2 categorizados + 1 sin categoría)");
        assertEquals(3.0, itemA.getPesoVotos(), 0.001,
                "El peso global suma los 3 votos registrados (1.0 cada uno)");
    }

    @Test
    void empateNeutralSumaMedioACadaPersonajeEnEnfrentamientoYRankingGlobal() {
        Personaje a = nuevoPersonaje("empate_a");
        Personaje b = nuevoPersonaje("empate_b");
        Voto empate = votoEmpate(a, b, nuevoUsuario("empate_global"));

        assertEquals(0.5,
                votoRepository.scoreByEnfrentamientoAndPersonaje(empate.getEnfrentamiento(), a),
                0.001,
                "El agregado del enfrentamiento debe sumar 0.5 al personaje1");
        assertEquals(0.5,
                votoRepository.scoreByEnfrentamientoAndPersonaje(empate.getEnfrentamiento(), b),
                0.001,
                "El agregado del enfrentamiento debe sumar 0.5 al personaje2");

        List<RankingItem> global = votoRepository.obtenerRanking();
        RankingItem itemA = buscar(global, a.getId());
        RankingItem itemB = buscar(global, b.getId());
        assertNotNull(itemA, "A debe aparecer en el ranking global tras el empate");
        assertNotNull(itemB, "B debe aparecer en el ranking global tras el empate");
        assertEquals(0.5, itemA.getVotos(), 0.001,
                "El ranking global debe acreditar 0.5 al personaje1");
        assertEquals(0.5, itemB.getVotos(), 0.001,
                "El ranking global debe acreditar 0.5 al personaje2");
        assertEquals(0.5, itemA.getPesoVotos(), 0.001,
                "El peso del ranking global debe repartir el empate al personaje1");
        assertEquals(0.5, itemB.getPesoVotos(), 0.001,
                "El peso del ranking global debe repartir el empate al personaje2");
    }

    @Test
    void topPorUsuarioOrdenaStatsPorScoreFraccionalDeEmpates() {
        Usuario usuario = nuevoUsuario("empate_stats");
        Personaje dosVotos = nuevoPersonaje("stats_dos");
        Personaje tresEmpates = nuevoPersonaje("stats_empates");

        votoNormal(dosVotos, nuevoPersonaje("stats_ruido_1"), usuario);
        votoNormal(dosVotos, nuevoPersonaje("stats_ruido_2"), usuario);
        votoEmpate(tresEmpates, nuevoPersonaje("stats_rival_1"), usuario);
        votoEmpate(tresEmpates, nuevoPersonaje("stats_rival_2"), usuario);
        votoEmpate(tresEmpates, nuevoPersonaje("stats_rival_3"), usuario);

        List<TopPersonajeItem> topUsuario = votoRepository.topPorUsuario(usuario, top);
        TopPersonajeItem itemDosVotos = buscarTop(topUsuario, dosVotos.getId());
        TopPersonajeItem itemTresEmpates = buscarTop(topUsuario, tresEmpates.getId());

        assertNotNull(itemDosVotos, "El personaje con votos normales debe aparecer en stats");
        assertNotNull(itemTresEmpates, "El personaje con empates debe aparecer en stats");
        assertEquals(2.0, itemDosVotos.votos(), 0.001,
                "Dos votos normales suman 2.0");
        assertEquals(1.5, itemTresEmpates.votos(), 0.001,
                "Tres empates suman 1.5, no 3 votos físicos");
        assertEquals(dosVotos.getId(), topUsuario.get(0).personajeId(),
                "Las stats deben ordenar por score fraccional, no por COUNT físico");
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

    private TopPersonajeItem buscarTop(List<TopPersonajeItem> items, Long personajeId) {
        return items.stream()
                .filter(it -> personajeId.equals(it.personajeId()))
                .findFirst()
                .orElse(null);
    }

    private Usuario nuevoUsuario(String tag) {
        String s = tag + "_" + UUID.randomUUID().toString().substring(0, 8);
        return usuarioRepository.save(new Usuario(s, "hash", s + "@example.com"));
    }

    private Enfrentamiento nuevoEnfrentamiento(Personaje a, Personaje b) {
        String s = "torneo_" + UUID.randomUUID().toString().substring(0, 8);
        Torneo torneo = torneoRepository.save(new Torneo(s, "Torneo " + s, "fixture"));
        return enfrentamientoRepository.save(new Enfrentamiento(torneo, a, b));
    }

    private Voto votoNormal(Personaje ganador, Personaje rival, Usuario usuario) {
        Voto voto = new Voto(ganador, usuario, nuevoEnfrentamiento(ganador, rival));
        return votoRepository.save(voto);
    }

    private Voto votoEmpate(Personaje a, Personaje b, Usuario usuario) {
        Voto voto = new Voto(a, usuario, nuevoEnfrentamiento(a, b));
        voto.setEmpate(true);
        voto.setPeso(new BigDecimal("0.50"));
        return votoRepository.save(voto);
    }
}
