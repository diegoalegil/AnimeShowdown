package com.diegoalegil.animeshowdown.config;

import java.util.concurrent.Executor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Configuración de ejecutores asíncronos.
 *
 * <p>Ajuste #4 (2026-05-21): antes este config solo declaraba
 * {@code emailExecutor}. Los {@code @Async} sin nombre explícito
 * (AuditLogService, IndexNowService, BadgeEventListener) caían al
 * fallback de Spring Boot ({@code SimpleAsyncTaskExecutor}) que crea
 * un hilo nuevo por cada tarea sin pool — peligroso en ráfagas.
 * Spring también logueaba warning {@code "more than one TaskExecutor
 * bean found, will rely on default"}.
 *
 * <p>Ahora:
 * <ul>
 *   <li>{@code taskExecutor} (@Primary) — pool default. Lo usa todo
 *       {@code @Async} sin nombre: audit, indexnow, badges.</li>
 *   <li>{@code emailExecutor} — pool dedicado para envíos de email con
 *       @Retryable. EmailService lo invoca explícitamente con
 *       {@code @Async("emailExecutor")}.</li>
 *   <li>{@link AsyncConfigurer} — handler que loguea (no swallowing
 *       silencioso) cuando una tarea {@code @Async} lanza excepción no
 *       capturada. Antes los errores se perdían en el {@code Future}
 *       descartado.</li>
 * </ul>
 *
 * <p>Pool dedicado email (Plan v2 §2.12):
 * <ul>
 *   <li>core 2, max 5: cubre el tráfico típico sin sobrecargar Railway free.</li>
 *   <li>queue 100: ráfagas (newsletter futura, mass invite) se encolan.</li>
 *   <li>keep-alive 60s: hilos ociosos se devuelven al SO.</li>
 *   <li>rejected: CallerRunsPolicy (default) — backpressure en lugar
 *       de descartar emails silenciosamente.</li>
 * </ul>
 *
 * <p>Pool default (taskExecutor):
 * <ul>
 *   <li>core 2, max 8, queue 200: mas holgado porque procesa audit,
 *       indexnow ping y badge listeners que pueden venir en burst.</li>
 *   <li>thread name prefix "task-" para distinguir en logs.</li>
 * </ul>
 *
 * <p>{@code @EnableRetry} activa el procesamiento de
 * {@code @Retryable}/{@code @Recover} en los beans (spring-retry).
 */
@Configuration
@EnableAsync
@EnableRetry
public class AsyncConfig implements AsyncConfigurer {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    /**
     * Ejecutor default para {@code @Async} sin nombre explícito.
     * @Primary garantiza que Spring lo elija entre los beans
     * {@code Executor} cuando se autowire por tipo, y AsyncConfigurer
     * lo declara también como executor para @Async no calificado.
     */
    @Override
    public Executor getAsyncExecutor() {
        return taskExecutor();
    }

    /**
     * Handler global para excepciones no capturadas en métodos
     * {@code @Async void}. Antes esos errores se perdían silenciosamente.
     * Ahora los logueamos con stack trace para que CI/monitoring los
     * capture.
     */
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
                log.error("Async uncaught exception en {}.{}: {}",
                        method.getDeclaringClass().getSimpleName(),
                        method.getName(),
                        ex.getMessage(),
                        ex);
    }

    @Bean(name = "taskExecutor")
    @Primary
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(200);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("task-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "emailExecutor")
    public Executor emailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("email-");
        executor.initialize();
        return executor;
    }
}
