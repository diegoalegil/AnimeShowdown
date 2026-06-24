package com.diegoalegil.animeshowdown.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.support.PostgresIntegrationTestBase;

/**
 * Valida el advisory lock por sesión anónima contra Postgres real
 * (Testcontainers): que el native query es SQL válido, mapea a escalar y no
 * falla dentro de la tx. La exclusión mutua entre transacciones la garantiza
 * {@code pg_advisory_xact_lock} de Postgres; aquí se fija que la llamada del
 * repositorio es correcta y reentrante en la misma tx (no se autobloquea).
 *
 * <p>En el flujo real, EnfrentamientoController gatea esta llamada por dialecto
 * (solo Postgres), así que en los tests del controller sobre H2 no se invoca.
 */
@SpringBootTest
@ActiveProfiles("test")
class VotoRepositoryAdvisoryLockTest extends PostgresIntegrationTestBase {

    @Autowired
    private VotoRepository votoRepository;

    @Test
    @Transactional
    void lockSesionAnonima_adquiereElLockYEsReentranteEnLaMismaTx() {
        assertThat(votoRepository.lockSesionAnonima("sesion-anon-xyz")).isEqualTo(1);
        // Re-tomar el MISMO lock en la misma tx no bloquea ni falla (los advisory
        // locks de Postgres se apilan por sesión).
        assertThat(votoRepository.lockSesionAnonima("sesion-anon-xyz")).isEqualTo(1);
        // Una clave distinta es otro lock independiente.
        assertThat(votoRepository.lockSesionAnonima("otra-sesion")).isEqualTo(1);
    }
}
