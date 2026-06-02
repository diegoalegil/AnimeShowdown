package com.diegoalegil.animeshowdown.service;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;

@ExtendWith(MockitoExtension.class)
class PersonajeVotoScoreServiceTest {

    @Mock private PersonajeVotoScoreRepository repository;

    @Test
    void votoNormalIncrementaUnPuntoDeFormaAtomica() {
        when(repository.incrementarScore(10L, 1.0d)).thenReturn(1);
        PersonajeVotoScoreService sut = new PersonajeVotoScoreService(repository);

        sut.registrar(false, 10L, null, null);

        verify(repository).incrementarScore(10L, 1.0d);
        verify(repository, never()).insertarSiFalta(anyLong());
    }

    @Test
    void empateIncrementaMedioPuntoACadaParticipante() {
        when(repository.incrementarScore(anyLong(), eq(0.5d))).thenReturn(1);
        PersonajeVotoScoreService sut = new PersonajeVotoScoreService(repository);

        sut.registrar(true, 10L, 10L, 20L);

        verify(repository).incrementarScore(10L, 0.5d);
        verify(repository).incrementarScore(20L, 0.5d);
        verify(repository, times(2)).incrementarScore(anyLong(), eq(0.5d));
        verify(repository, never()).insertarSiFalta(anyLong());
    }

    @Test
    void siLaFilaAunNoExisteLaCreaYReintentaElIncremento() {
        // 0 filas afectadas la 1ª vez (no existe) → crea idempotente → 1 al reintentar.
        when(repository.incrementarScore(10L, 1.0d)).thenReturn(0, 1);
        PersonajeVotoScoreService sut = new PersonajeVotoScoreService(repository);

        sut.registrar(false, 10L, null, null);

        InOrder inOrder = inOrder(repository);
        inOrder.verify(repository).incrementarScore(10L, 1.0d);
        inOrder.verify(repository).insertarSiFalta(10L);
        inOrder.verify(repository).incrementarScore(10L, 1.0d);
    }
}
