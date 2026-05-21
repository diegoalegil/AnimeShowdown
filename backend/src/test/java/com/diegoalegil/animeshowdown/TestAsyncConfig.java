package com.diegoalegil.animeshowdown;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;

/**
 * Sustituye el TaskExecutor por defecto por uno SÍNCRONO en tests.
 *
 * <p>Sin esto, los métodos @Async (AuditLogService.registrar,
 * EmailService.*, BadgeEventListener.*, IndexNowService.*) se programan
 * en otro hilo y la assertion del test (.findAll() del repositorio)
 * puede correr ANTES de que la fila se persista — flaky o directamente
 * falso negativo.
 *
 * <p>Con SyncTaskExecutor, el @Async se ejecuta en el mismo hilo y
 * bloquea hasta terminar — comportamiento determinista para tests.
 * Producción sigue usando el executor real (AsyncConfig).
 *
 * <p>Audit fix #3 follow-up (2026-05-21): el siguiente paso natural
 * (capturar AsyncUncaughtException via AsyncConfigurer) entra en
 * conflicto con AsyncConfig prod que también implementa AsyncConfigurer.
 * Si en el futuro queremos fail-on-async-error, hay que migrar el
 * pattern via spring.factories o un test-listener específico.
 * Por ahora, el AsyncUncaughtExceptionHandler de AsyncConfig (prod)
 * loguea ERROR con stack trace — los errores async aparecen en CI
 * logs visibles aunque el test pase verde.
 */
@TestConfiguration
public class TestAsyncConfig {

    @Bean
    @Primary
    public TaskExecutor taskExecutor() {
        return new SyncTaskExecutor();
    }
}
