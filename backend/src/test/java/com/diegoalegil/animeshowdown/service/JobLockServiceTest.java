package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Verifica el claim atómico del lock de jobs: solo una adquisición gana dentro
 * del TTL; tras vencer el TTL se vuelve a poder reclamar. Usa un Clock fijo
 * controlable (instanciando el service a mano) para no depender de timing real.
 */
@SpringBootTest
@ActiveProfiles("test")
class JobLockServiceTest {

    @Autowired private JdbcTemplate jdbcTemplate;

    private JobLockService conReloj(Instant instante) {
        return new JobLockService(jdbcTemplate, Clock.fixed(instante, ZoneOffset.UTC));
    }

    @Test
    void claimAtomicoSerializaYRespetaTtl() {
        String clave = "test_job_" + UUID.randomUUID().toString().substring(0, 8);
        jdbcTemplate.update("INSERT INTO job_lock (clave, ejecutado_en) VALUES (?, NULL)", clave);

        Instant t0 = Instant.parse("2026-06-03T00:00:00Z");
        JobLockService enT0 = conReloj(t0);

        // Primera réplica gana el slot.
        assertThat(enT0.intentarAdquirir(clave, Duration.ofMinutes(10))).isTrue();
        // Segunda réplica (mismo instante) lo ve reclamado dentro del TTL → salta.
        assertThat(enT0.intentarAdquirir(clave, Duration.ofMinutes(10))).isFalse();

        // Dentro del TTL (9 min después) sigue bloqueado.
        assertThat(conReloj(t0.plus(Duration.ofMinutes(9)))
                .intentarAdquirir(clave, Duration.ofMinutes(10))).isFalse();

        // Pasado el TTL (11 min después) se puede volver a reclamar.
        assertThat(conReloj(t0.plus(Duration.ofMinutes(11)))
                .intentarAdquirir(clave, Duration.ofMinutes(10))).isTrue();
    }

    @Test
    void clavesDistintasSonIndependientes() {
        String a = "test_job_a_" + UUID.randomUUID().toString().substring(0, 8);
        String b = "test_job_b_" + UUID.randomUUID().toString().substring(0, 8);
        jdbcTemplate.update("INSERT INTO job_lock (clave, ejecutado_en) VALUES (?, NULL), (?, NULL)", a, b);

        JobLockService svc = conReloj(Instant.parse("2026-06-03T00:00:00Z"));
        assertThat(svc.intentarAdquirir(a, Duration.ofMinutes(10))).isTrue();
        // Reclamar 'a' no afecta a 'b'.
        assertThat(svc.intentarAdquirir(b, Duration.ofMinutes(10))).isTrue();
    }
}
