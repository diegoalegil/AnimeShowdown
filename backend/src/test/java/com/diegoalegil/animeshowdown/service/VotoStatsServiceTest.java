package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@SpringBootTest
@ActiveProfiles("test")
class VotoStatsServiceTest {

    @Autowired private VotoStatsService votoStatsService;
    @Autowired private RankingMaterializadoService rankingMaterializadoService;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private TorneoRepository torneoRepository;
    @Autowired private EnfrentamientoRepository enfrentamientoRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private VotoRepository votoRepository;

    @Test
    void registrarEmpateActualizaRankingAllTimePeriodoYMatchSinReagruparVotos() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Personaje a = personajeRepository.save(new Personaje(
                "stats_a_" + suffix, "Stats A " + suffix, "Stats QA",
                "fixture", "/img/qa/stats-a.webp"));
        Personaje b = personajeRepository.save(new Personaje(
                "stats_b_" + suffix, "Stats B " + suffix, "Stats QA",
                "fixture", "/img/qa/stats-b.webp"));
        Usuario usuario = usuarioRepository.save(new Usuario(
                "stats_user_" + suffix, "hash", "stats_" + suffix + "@example.com"));
        Torneo torneo = torneoRepository.save(new Torneo(
                "stats_torneo_" + suffix, "Stats torneo " + suffix, "fixture"));
        Enfrentamiento enfrentamiento = enfrentamientoRepository.save(new Enfrentamiento(torneo, a, b));

        Voto empate = new Voto(a, usuario, enfrentamiento);
        empate.setEmpate(true);
        empate.setPeso(new BigDecimal("0.50"));
        empate.setFecha(LocalDateTime.now().minusHours(1));
        empate = votoRepository.save(empate);

        var snapshot = votoStatsService.registrar(empate);

        assertThat(snapshot.scoreDe(a)).isEqualTo(0.5);
        assertThat(snapshot.scoreDe(b)).isEqualTo(0.5);
        assertThat(rankingMaterializadoService.rankingAllTime(50))
                .extracting(item -> item.getPersonaje().getSlug())
                .contains("stats_a_" + suffix, "stats_b_" + suffix);
        RankingItem periodo = rankingMaterializadoService
                .rankingDesde(LocalDateTime.now().minusDays(1), 50)
                .stream()
                .filter(item -> item.getPersonaje().getId().equals(a.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(periodo.getVotos()).isEqualTo(0.5);
        assertThat(periodo.getPesoVotos()).isEqualTo(0.5);
    }
}
