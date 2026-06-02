package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

class TwoFactorChallengeServiceTest {

    @Test
    void consumirEsOneShotAtomico() throws Exception {
        TwoFactorChallengeService service = new TwoFactorChallengeService();
        String token = service.emitir(42L).token();
        int intentos = 32;
        CountDownLatch salida = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(intentos);
        try {
            List<Future<Optional<Long>>> resultados = new ArrayList<>();
            Callable<Optional<Long>> consumir = () -> {
                salida.await();
                return service.consumir(token);
            };
            for (int i = 0; i < intentos; i++) {
                resultados.add(pool.submit(consumir));
            }

            salida.countDown();

            long consumosValidos = 0;
            for (Future<Optional<Long>> resultado : resultados) {
                if (resultado.get().isPresent()) {
                    consumosValidos++;
                }
            }
            assertThat(consumosValidos).isEqualTo(1);
            assertThat(service.consumir(token)).isEmpty();
        } finally {
            pool.shutdownNow();
        }
    }
}
