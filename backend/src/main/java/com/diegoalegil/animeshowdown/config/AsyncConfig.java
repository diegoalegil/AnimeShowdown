package com.diegoalegil.animeshowdown.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Configuración de ejecutores asíncronos.
 *
 * Plan v2 §2.12 — pool dedicado "emailExecutor" para los envíos de email
 * con @Retryable + @Recover. Antes EmailService usaba el SimpleAsyncTaskExecutor
 * por defecto de Spring Boot que crea un hilo nuevo por cada tarea sin
 * límite — peligroso si Resend está lento y se acumulan envíos.
 *
 * Pool dedicado:
 *   - core 2, max 5: cubre el tráfico típico sin sobrecargar Railway free.
 *   - queue 100: si llegan ráfagas (newsletter futura, mass invite, etc.)
 *     se encolan en lugar de crear hilos sin límite.
 *   - keep-alive 60s: hilos ociosos se devuelven al SO.
 *   - rejected: CallerRunsPolicy (default) — si se desborda la queue,
 *     el thread llamante ejecuta el envío (sirve de backpressure
 *     en lugar de descartar emails silenciosamente).
 *
 * @EnableRetry activa el procesamiento de @Retryable/@Recover en los
 * beans (spring-retry).
 */
@Configuration
@EnableAsync
@EnableRetry
public class AsyncConfig {

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
