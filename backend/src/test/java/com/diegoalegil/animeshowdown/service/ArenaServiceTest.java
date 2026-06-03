package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@SpringBootTest
@ActiveProfiles("test")
class ArenaServiceTest {

    @Autowired private ArenaService arenaService;
    @Autowired private EnfrentamientoRepository enfrentamientoRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void ensureArenaCreaTorneoSistemaSinBracketEIdempotente() {
        Torneo a1 = arenaService.ensureArena();
        Torneo a2 = arenaService.ensureArena();

        assertThat(a2.getId()).isEqualTo(a1.getId());
        assertThat(a1.isEsArena()).isTrue();
        assertThat(a1.getEstado()).isEqualTo(EstadoTorneo.IN_PROGRESS);
        assertThat(a1.isPublico()).isFalse(); // no aparece en /torneos
    }

    @Test
    void mantenerGeneraDuelosAbiertosDelRoster() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        for (int i = 0; i < 6; i++) {
            personajeRepository.save(new Personaje(
                    "arena_gen_" + i + "_" + suffix, "Arena Gen " + i, "Arena QA",
                    "fixture", "/img/qa/arena-" + i + ".webp"));
        }

        Torneo arena = arenaService.ensureArena();
        long antes = enfrentamientoRepository.countByTorneoAndGanadorIsNull(arena);
        arenaService.mantener();
        long despues = enfrentamientoRepository.countByTorneoAndGanadorIsNull(arena);

        assertThat(despues).isGreaterThan(antes);
    }

    @Test
    void resolverCierraDueloMaduroConGanadorPorScore() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Personaje a = personajeRepository.save(new Personaje(
                "arena_res_a_" + suffix, "Arena Res A", "Arena QA", "fixture", "/img/qa/ra.webp"));
        Personaje b = personajeRepository.save(new Personaje(
                "arena_res_b_" + suffix, "Arena Res B", "Arena QA", "fixture", "/img/qa/rb.webp"));
        Torneo arena = arenaService.ensureArena();
        Enfrentamiento enf = enfrentamientoRepository.save(new Enfrentamiento(arena, a, b));

        // Score por-match (voto_enfrentamiento_stats) por encima del umbral (50):
        // A=40, B=20 → total 60, gana A.
        jdbcTemplate.update("""
                INSERT INTO voto_enfrentamiento_stats (enfrentamiento_id, personaje_id, votos_score, updated_at)
                VALUES (?, ?, 40, CURRENT_TIMESTAMP)
                """, enf.getId(), a.getId());
        jdbcTemplate.update("""
                INSERT INTO voto_enfrentamiento_stats (enfrentamiento_id, personaje_id, votos_score, updated_at)
                VALUES (?, ?, 20, CURRENT_TIMESTAMP)
                """, enf.getId(), b.getId());

        arenaService.mantener();

        Enfrentamiento resuelto = enfrentamientoRepository.findById(enf.getId()).orElseThrow();
        assertThat(resuelto.getGanador()).isNotNull();
        assertThat(resuelto.getGanador().getId()).isEqualTo(a.getId());
    }
}
