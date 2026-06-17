package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

@SpringBootTest
@ActiveProfiles("test")
class TorneoCreationConcurrencyTest {

    @Autowired private TorneoService torneoService;
    @Autowired private TorneoRepository torneoRepository;

    private final List<Torneo> creados = Collections.synchronizedList(new ArrayList<>());

    @AfterEach
    void limpiar() {
        for (Torneo torneo : creados) {
            if (torneo.getId() != null) {
                torneoRepository.findById(torneo.getId()).ifPresent(torneoRepository::delete);
            }
        }
        creados.clear();
    }

    @Test
    void creacionesConcurrentesConMismoNombreRecibenSlugsDistintos() throws Exception {
        int total = 6;
        String nombre = "Carrera Slug " + System.nanoTime();
        ExecutorService pool = Executors.newFixedThreadPool(total);
        CountDownLatch preparados = new CountDownLatch(total);
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Torneo>> futures = new ArrayList<>();

        for (int i = 0; i < total; i++) {
            futures.add(pool.submit(() -> {
                TorneoCrearRequest request = new TorneoCrearRequest(nombre, "Prueba de carrera de slug");
                preparados.countDown();
                salida.await(5, TimeUnit.SECONDS);
                return torneoService.crear(request);
            }));
        }

        assertThat(preparados.await(5, TimeUnit.SECONDS)).isTrue();
        salida.countDown();

        for (Future<Torneo> future : futures) {
            Torneo torneo = future.get(15, TimeUnit.SECONDS);
            creados.add(torneo);
        }
        pool.shutdown();
        assertThat(pool.awaitTermination(5, TimeUnit.SECONDS)).isTrue();

        assertThat(creados).hasSize(total);
        assertThat(creados)
                .extracting(Torneo::getSlug)
                .doesNotHaveDuplicates()
                .allSatisfy(slug -> assertThat(slug).startsWith("carrera-slug-"));
    }
}
