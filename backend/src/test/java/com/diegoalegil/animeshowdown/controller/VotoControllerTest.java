package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Smoke tests de los endpoints publicos de ranking. Cubren las queries que
 * tambien alimentan /ranking, /leaderboards y recomendaciones de personajes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VotoControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private VotoRepository votoRepository;
    @Autowired private com.diegoalegil.animeshowdown.service.VotoStatsService votoStatsService;
    @Autowired private org.springframework.cache.CacheManager cacheManager;

    @Test
    void rankingsPublicosDevuelvenArraysSinExplotarConVotosReales() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Personaje a = personajeRepository.save(new Personaje(
                "ranking_a_" + suffix,
                "Ranking A " + suffix,
                "QA Anime",
                "Fixture ranking A",
                "/img/qa/ranking-a.webp"));
        Personaje b = personajeRepository.save(new Personaje(
                "ranking_b_" + suffix,
                "Ranking B " + suffix,
                "QA Anime",
                "Fixture ranking B",
                "/img/qa/ranking-b.webp"));
        Usuario u = usuarioRepository.save(new Usuario(
                "rankuser_" + suffix,
                "hash",
                "rankuser_" + suffix + "@example.com"));

        guardarVoto(new Voto(a, u));
        guardarVoto(new Voto(a, u));
        guardarVoto(new Voto(b, u));

        mvc.perform(get("/api/votos/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'ranking_a_" + suffix + "')]").exists());

        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("periodo", "all")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'ranking_a_" + suffix + "')]").exists());

        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("periodo", "mes")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'ranking_a_" + suffix + "')]").exists());

        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("anime", "QA Anime")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'ranking_b_" + suffix + "')]").exists());

        mvc.perform(get("/api/votos/ranking/movimientos?limit=20&dias=7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        mvc.perform(get("/api/votos/top-voters?periodo=all&limit=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.username == 'rankuser_" + suffix + "')]").exists());

        // ELO canónico: mapa slug→elo de todo el catálogo. 'a' tiene votos, así
        // que su elo (semilla 1500 sin AniList + ajuste por votos) es >= 1500.
        mvc.perform(get("/api/votos/ranking/elo-canonico"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['ranking_a_" + suffix + "']")
                        .value(org.hamcrest.Matchers.greaterThanOrEqualTo(1500)));
    }

    /**
     * Ranking por intención de voto (feature #15): el filtro {@code categoria}
     * de /ranking/segmentado, su precedencia frente a {@code anime}, su
     * tolerancia a categorías inválidas (sin 400) y /categorias-disponibles.
     */
    @Test
    void rankingSegmentadoPorCategoriaPrecedenciaYDisponibles() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String anime = "Cat QA " + suffix;
        Personaje a = personajeRepository.save(new Personaje(
                "cat_seg_a_" + suffix, "Cat Seg A " + suffix, anime,
                "fixture A", "/img/qa/cat-a.webp"));
        Personaje b = personajeRepository.save(new Personaje(
                "cat_seg_b_" + suffix, "Cat Seg B " + suffix, anime,
                "fixture B", "/img/qa/cat-b.webp"));
        Usuario u = usuarioRepository.save(new Usuario(
                "catseg_" + suffix, "hash", "catseg_" + suffix + "@example.com"));

        // A: 2 votos "poder"; B: 1 voto "diseno".
        Voto va1 = new Voto(a, u);
        va1.setCategoria("poder");
        guardarVoto(va1);
        Voto va2 = new Voto(a, u);
        va2.setCategoria("poder");
        guardarVoto(va2);
        Voto vb1 = new Voto(b, u);
        vb1.setCategoria("diseno");
        guardarVoto(vb1);

        // categoria=poder → A presente; B ausente (su único voto es de "diseno").
        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("categoria", "poder")
                        .param("limit", "200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'cat_seg_a_" + suffix + "')]").exists())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'cat_seg_b_" + suffix + "')]").doesNotExist());

        // Precedencia: anime gana a categoria. Con ambos, devuelve TODOS los
        // personajes del anime (incluido B, cuyo voto no es "poder").
        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("anime", anime)
                        .param("categoria", "poder")
                        .param("limit", "200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.personaje.slug == 'cat_seg_b_" + suffix + "')]").exists());

        // Categoría inválida → NO 400: se ignora y cae a la rama de periodo.
        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("categoria", "categoria-que-no-existe")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // categorias-disponibles lista los ids de wire con votos.
        mvc.perform(get("/api/votos/ranking/categorias-disponibles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasItem("poder")))
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasItem("diseno")));
    }

    @Test
    void rankingPorCategoriaSeCachea() throws Exception {
        // El ranking por categoría agrega en vivo (GROUP BY sobre votos); ahora
        // va por @Cacheable. Verificamos que la llamada puebla EXACTAMENTE la key
        // catId:periodoKey:limit, así dos requests del mismo combo no re-pegan.
        var cache = cacheManager.getCache("votos-ranking-categoria");
        assertThat(cache).isNotNull();
        cache.clear();
        String catId = com.diegoalegil.animeshowdown.model.CategoriaVoto.fromId("poder").getId();

        mvc.perform(get("/api/votos/ranking/segmentado")
                        .param("categoria", "poder")
                        .param("periodo", "all")
                        .param("limit", "20"))
                .andExpect(status().isOk());

        assertThat(cache.get(catId + ":all:20")).isNotNull();
    }

    private Voto guardarVoto(Voto voto) {
        Voto guardado = votoRepository.save(voto);
        var snapshot = votoStatsService.registrar(guardado);
        // En prod las agregaciones diaria/torneo se materializan async (ver
        // VotoAgregadoStatsListener); aquí las aplicamos inline para que los
        // rankings por ventana (mes/semana) las vean en el smoke test.
        var dia = (guardado.getFecha() != null
                ? guardado.getFecha() : java.time.LocalDateTime.now()).toLocalDate();
        Long torneoId = guardado.getEnfrentamiento() != null
                && guardado.getEnfrentamiento().getTorneo() != null
                ? guardado.getEnfrentamiento().getTorneo().getId() : null;
        votoStatsService.registrarAgregadosDiarios(
                snapshot.deltas().stream()
                        .map(d -> new com.diegoalegil.animeshowdown.event.VotoAgregadoEvent.DiaDelta(
                                d.personaje().getId(), d.votosScore(), d.pesoVotos()))
                        .toList(),
                dia, torneoId);
        return guardado;
    }
}
