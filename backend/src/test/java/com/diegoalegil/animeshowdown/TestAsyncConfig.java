package com.diegoalegil.animeshowdown;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;

/**
 * Sustituye el TaskExecutor por defecto por uno SÍNCRONO en tests.
 *
 * Sin esto, los métodos @Async (AuditLogService.registrar, EmailService.*)
 * se programan en otro hilo y la assertion del test (.findAll() del
 * repositorio) puede correr ANTES de que la fila se persista — flaky o
 * directamente falso negativo.
 *
 * Con SyncTaskExecutor, el @Async se ejecuta en el mismo hilo y bloquea
 * hasta terminar — comportamiento determinista para tests. Producción
 * sigue usando el executor real (Spring Boot default).
 */
@TestConfiguration
public class TestAsyncConfig {

    @Bean
    @Primary
    public TaskExecutor taskExecutor() {
        return new SyncTaskExecutor();
    }
}
