package com.diegoalegil.animeshowdown.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.LockModeType;

class DueloLiveRepositoryContractTest {

    @Test
    void colaWaitingUsaLockPesimistaParaClaimHumanoYScheduler() throws Exception {
        assertPessimisticWrite("findWaitingOrderByCreadoEnForUpdate");
        assertPessimisticWrite("findWaitingDueForUpdate", java.time.LocalDateTime.class);
    }

    private static void assertPessimisticWrite(String name, Class<?>... parameterTypes) throws Exception {
        Method method = DueloLiveRepository.class.getMethod(name, parameterTypes);
        Lock lock = method.getAnnotation(Lock.class);
        assertThat(lock).isNotNull();
        assertThat(lock.value()).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
    }
}
