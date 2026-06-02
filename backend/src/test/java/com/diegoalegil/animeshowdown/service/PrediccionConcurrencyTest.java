package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Prediccion;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
class PrediccionConcurrencyTest {

    @Autowired private PrediccionService prediccionService;
    @Autowired private TorneoAutoAdvanceService torneoAutoAdvanceService;
    @Autowired private TransactionTemplate tx;
    @Autowired private TorneoRepository torneoRepository;
    @Autowired private EnfrentamientoRepository enfrentamientoRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private PrediccionRepository prediccionRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private TorneoOperacionLockService torneoOperacionLockService;

    @Test
    void aplicarPrediccionEsperaCierreDelTorneoYRechazaCambioTardio() throws Exception {
        Setup setup = crearSetup();
        CountDownLatch torneoBloqueado = new CountDownLatch(1);
        CountDownLatch puedeCerrar = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);

        try {
            Future<Void> cierre = pool.submit(() -> {
                tx.executeWithoutResult(status -> {
                    torneoOperacionLockService.lock(setup.torneoId());
                    Torneo torneo = torneoRepository.findById(setup.torneoId()).orElseThrow();
                    torneoBloqueado.countDown();
                    await(puedeCerrar);

                    Personaje ganador = personajeRepository.findById(setup.personaje1Id()).orElseThrow();
                    torneo.setEstado(EstadoTorneo.FINISHED);
                    torneo.setGanadorPersonaje(ganador);
                    Enfrentamiento enfrentamiento = enfrentamientoRepository.findById(setup.enfrentamientoId())
                            .orElseThrow();
                    enfrentamiento.setGanador(ganador);
                    Prediccion prediccion = prediccionRepository.findById(setup.prediccionId()).orElseThrow();
                    prediccion.setAcertada(true);
                });
                return null;
            });

            assertThat(torneoBloqueado.await(5, TimeUnit.SECONDS)).isTrue();
            Usuario usuario = usuarioRepository.findById(setup.usuarioId()).orElseThrow();
            Future<?> cambio = pool.submit(() -> prediccionService.aplicar(
                    usuario, setup.enfrentamientoId(), setup.personaje2Id()));

            Thread.sleep(300);
            assertThat(cambio).isNotDone();
            puedeCerrar.countDown();

            assertThatThrownBy(() -> cambio.get(5, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .hasCauseInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("No puedes predecir");
            cierre.get(5, TimeUnit.SECONDS);

            Prediccion finalizada = prediccionRepository.findById(setup.prediccionId()).orElseThrow();
            assertThat(finalizada.getPersonajePredicho().getId()).isEqualTo(setup.personaje1Id());
            assertThat(finalizada.getAcertada()).isTrue();
        } finally {
            puedeCerrar.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void avanzarSiProcedeEsperaElLockDeOperacionDelTorneo() throws Exception {
        Setup setup = crearSetup();
        CountDownLatch lockTomado = new CountDownLatch(1);
        CountDownLatch puedeLiberar = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);

        try {
            // Hilo A: mantiene abierto el lock de operación del torneo, simulando
            // una predicción/finalize en vuelo que aún no ha commiteado.
            Future<Void> tenedor = pool.submit(() -> {
                tx.executeWithoutResult(status -> {
                    torneoOperacionLockService.lock(setup.torneoId());
                    lockTomado.countDown();
                    await(puedeLiberar);
                });
                return null;
            });

            assertThat(lockTomado.await(5, TimeUnit.SECONDS)).isTrue();

            // Hilo B: el auto-avance debe BLOQUEARSE en el mismo lock. Antes del
            // fix no lo tomaba y completaba de inmediato, dejando viva la carrera
            // M-DATA-02 (predicción leyendo el enfrentamiento sin cerrojo mientras
            // el avance le fijaba el ganador).
            Future<?> avance = pool.submit(() ->
                    torneoAutoAdvanceService.avanzarSiProcede(setup.torneoId(), "vote"));

            Thread.sleep(300);
            assertThat(avance).isNotDone();

            puedeLiberar.countDown();
            avance.get(5, TimeUnit.SECONDS);
            tenedor.get(5, TimeUnit.SECONDS);
        } finally {
            puedeLiberar.countDown();
            pool.shutdownNow();
        }
    }

    private Setup crearSetup() {
        return tx.execute(status -> {
            String sufijo = UUID.randomUUID().toString().substring(0, 8);
            Personaje p1 = personajeRepository.findBySlug("luffy").orElseThrow();
            Personaje p2 = personajeRepository.findBySlug("zoro").orElseThrow();
            Usuario usuario = usuarioRepository.save(new Usuario(
                    "pred_lock_" + sufijo,
                    "hash",
                    "pred_lock_" + sufijo + "@example.com"));
            Torneo torneo = torneoRepository.save(new Torneo(
                    "pred-lock-" + sufijo,
                    "Pred Lock " + sufijo,
                    "test"));
            torneo.setEstado(EstadoTorneo.IN_PROGRESS);
            Enfrentamiento enfrentamiento = enfrentamientoRepository.save(new Enfrentamiento(torneo, p1, p2));
            Prediccion prediccion = prediccionRepository.save(new Prediccion(usuario, enfrentamiento, p1));
            return new Setup(
                    usuario.getId(),
                    torneo.getId(),
                    enfrentamiento.getId(),
                    prediccion.getId(),
                    p1.getId(),
                    p2.getId());
        });
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) {
                throw new AssertionError("timeout esperando latch de test");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError("test interrumpido", e);
        }
    }

    private record Setup(
            Long usuarioId,
            Long torneoId,
            Long enfrentamientoId,
            Long prediccionId,
            Long personaje1Id,
            Long personaje2Id) {}
}
