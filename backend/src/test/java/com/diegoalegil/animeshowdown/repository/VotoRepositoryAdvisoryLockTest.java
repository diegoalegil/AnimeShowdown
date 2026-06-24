package com.diegoalegil.animeshowdown.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.diegoalegil.animeshowdown.support.PostgresIntegrationTestBase;

/**
 * Valida el advisory lock por sesión anónima contra Postgres real
 * (Testcontainers): que el native query es SQL válido, mapea a escalar y no
 * falla dentro de una tx. La exclusión mutua entre transacciones la garantiza
 * {@code pg_advisory_xact_lock}; aquí se fija que la llamada del repositorio es
 * correcta y reentrante en la misma tx.
 *
 * <p>Se usa {@link TransactionTemplate} (tx programática) en vez de
 * {@code @Transactional} en el método: el advisory lock necesita una tx real, y
 * la tx programática vía el PlatformTransactionManager es la forma robusta de
 * obtenerla en este contexto. En el flujo real, EnfrentamientoController gatea
 * esta llamada por dialecto (solo Postgres), así que en H2 no se invoca.
 */
@SpringBootTest
@ActiveProfiles("test")
class VotoRepositoryAdvisoryLockTest extends PostgresIntegrationTestBase {

    @Autowired
    private VotoRepository votoRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void lockSesionAnonima_esSqlValidoYReentranteEnLaMismaTx() {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);

        Integer dentroDeTx = tx.execute(status -> {
            // Dos tomas del MISMO lock en la misma tx: Postgres apila los advisory
            // locks por sesión, así que no se autobloquea ni falla.
            assertThat(votoRepository.lockSesionAnonima("sesion-anon-xyz")).isEqualTo(1);
            assertThat(votoRepository.lockSesionAnonima("sesion-anon-xyz")).isEqualTo(1);
            // Una clave distinta es otro lock independiente.
            return votoRepository.lockSesionAnonima("otra-sesion");
        });

        assertThat(dentroDeTx).isEqualTo(1);
    }
}
