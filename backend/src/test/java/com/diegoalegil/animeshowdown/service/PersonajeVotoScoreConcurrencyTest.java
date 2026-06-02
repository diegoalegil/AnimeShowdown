package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.model.PersonajeVotoScore;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;

@SpringBootTest
@ActiveProfiles("test")
class PersonajeVotoScoreConcurrencyTest {

    @Autowired private PersonajeVotoScoreService personajeVotoScoreService;
    @Autowired private PersonajeVotoScoreRepository repository;
    @Autowired private PersonajeRepository personajeRepository;

    @Test
    void votosConcurrentesAlMismoPersonajeConvergenSinPerdidas() throws Exception {
        Long personajeId = personajeRepository.findBySlug("luffy").orElseThrow().getId();
        double antes = scoreActual(personajeId);

        int hilos = 10;
        ExecutorService pool = Executors.newFixedThreadPool(hilos);
        CountDownLatch listos = new CountDownLatch(hilos);
        CountDownLatch arranca = new CountDownLatch(1);
        CountDownLatch terminados = new CountDownLatch(hilos);
        AtomicInteger errores = new AtomicInteger();

        try {
            for (int i = 0; i < hilos; i++) {
                pool.submit(() -> {
                    listos.countDown();
                    try {
                        arranca.await(5, TimeUnit.SECONDS);
                        personajeVotoScoreService.registrar(false, personajeId, null, null);
                    } catch (Exception e) {
                        errores.incrementAndGet();
                    } finally {
                        terminados.countDown();
                    }
                });
            }
            assertThat(listos.await(5, TimeUnit.SECONDS)).isTrue();
            arranca.countDown(); // todos disparan a la vez → máxima contención sobre la fila
            assertThat(terminados.await(15, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        assertThat(errores.get()).isZero();
        // El incremento atómico (UPDATE ... votos_score = votos_score + delta) no
        // pierde actualizaciones: +1.0 por cada uno de los 10 votos concurrentes.
        assertThat(scoreActual(personajeId) - antes).isEqualTo(10.0d);
    }

    private double scoreActual(Long personajeId) {
        return repository.findById(personajeId)
                .map(PersonajeVotoScore::getVotosScore)
                .orElse(0.0d);
    }
}
