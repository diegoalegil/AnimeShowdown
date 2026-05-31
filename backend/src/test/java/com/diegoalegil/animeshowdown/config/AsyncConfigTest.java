package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

class AsyncConfigTest {

    private final AsyncConfig asyncConfig = new AsyncConfig();

    @Test
    void taskExecutorAplicaBackpressureCuandoLaColaSeLlena() {
        Executor executor = asyncConfig.taskExecutor();

        try {
            assertThat(executor).isInstanceOf(ThreadPoolTaskExecutor.class);
            ThreadPoolTaskExecutor taskExecutor = (ThreadPoolTaskExecutor) executor;

            assertThat(taskExecutor.getThreadPoolExecutor().getRejectedExecutionHandler())
                    .isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);
        } finally {
            ((ThreadPoolTaskExecutor) executor).shutdown();
        }
    }

    @Test
    void emailExecutorAplicaBackpressureCuandoLaColaSeLlena() {
        Executor executor = asyncConfig.emailExecutor();

        try {
            assertThat(executor).isInstanceOf(ThreadPoolTaskExecutor.class);
            ThreadPoolTaskExecutor taskExecutor = (ThreadPoolTaskExecutor) executor;

            assertThat(taskExecutor.getThreadPoolExecutor().getRejectedExecutionHandler())
                    .isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);
        } finally {
            ((ThreadPoolTaskExecutor) executor).shutdown();
        }
    }
}
