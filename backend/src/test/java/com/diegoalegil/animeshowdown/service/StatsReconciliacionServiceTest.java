package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Verifica que la reconciliación corrige el drift de las stats materializadas:
 * guardamos votos SIN disparar los listeners de materialización (simulando
 * eventos async perdidos) y comprobamos que reconciliar() deja las tablas =
 * función de `votos`. Además es convergente (una segunda corrida no ve drift).
 */
@SpringBootTest
@ActiveProfiles("test")
class StatsReconciliacionServiceTest {

    @Autowired private StatsReconciliacionService service;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private VotoRepository votoRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void corrigeStatsMaterializadasFaltantes() {
        String sfx = UUID.randomUUID().toString().substring(0, 8);
        Personaje p = personajeRepository.save(new Personaje(
                "recon_" + sfx, "Recon " + sfx, "Recon QA", "fixture", "/img/qa/recon.webp"));

        // 3 usuarios distintos votan a p. Guardamos el voto directo SIN llamar a
        // VotoStatsService/PersonajeVotoScoreService: la materialización queda
        // "perdida" (= el evento async no llegó).
        for (int i = 0; i < 3; i++) {
            Usuario u = usuarioRepository.save(new Usuario(
                    "reconu_" + i + "_" + sfx, "hash", "reconu_" + i + "_" + sfx + "@example.com"));
            votoRepository.save(new Voto(p, u));
        }

        // Antes: sin fila materializada para p.
        assertThat(scoreVotoPersonajeStats(p.getId())).isNull();

        StatsReconciliacionService.Resultado r = service.reconciliar();

        // Después: ambas tablas reflejan los 3 votos (score 3, peso 3).
        assertThat(scoreVotoPersonajeStats(p.getId())).isEqualByComparingTo("3.00");
        assertThat(pesoVotoPersonajeStats(p.getId())).isEqualByComparingTo("3.00");
        assertThat(personajeVotoScore(p.getId())).isEqualTo(3.0d);
        assertThat(r.total()).isGreaterThan(0);

        // Convergente: una segunda corrida deja el valor de p estable.
        service.reconciliar();
        assertThat(scoreVotoPersonajeStats(p.getId())).isEqualByComparingTo("3.00");
        assertThat(personajeVotoScore(p.getId())).isEqualTo(3.0d);
    }

    private BigDecimal scoreVotoPersonajeStats(Long personajeId) {
        return jdbcTemplate.query(
                "SELECT votos_score FROM voto_personaje_stats WHERE personaje_id = ?",
                rs -> rs.next() ? rs.getBigDecimal(1) : null, personajeId);
    }

    private BigDecimal pesoVotoPersonajeStats(Long personajeId) {
        return jdbcTemplate.query(
                "SELECT peso_votos FROM voto_personaje_stats WHERE personaje_id = ?",
                rs -> rs.next() ? rs.getBigDecimal(1) : null, personajeId);
    }

    private Double personajeVotoScore(Long personajeId) {
        return jdbcTemplate.query(
                "SELECT votos_score FROM personaje_voto_score WHERE personaje_id = ?",
                rs -> rs.next() ? rs.getDouble(1) : null, personajeId);
    }
}
