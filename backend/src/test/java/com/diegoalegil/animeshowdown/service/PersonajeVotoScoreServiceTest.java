package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.PersonajeVotoScore;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;

@ExtendWith(MockitoExtension.class)
class PersonajeVotoScoreServiceTest {

    @Mock private PersonajeVotoScoreRepository repository;

    @Test
    void registraVotoNormalComoUnPuntoMaterializado() {
        Personaje personaje = personaje(10L);
        PersonajeVotoScoreService sut = new PersonajeVotoScoreService(repository);
        when(repository.findByPersonajeIdForUpdate(10L)).thenReturn(Optional.empty());

        sut.registrar(new Voto(personaje));

        ArgumentCaptor<PersonajeVotoScore> captor = ArgumentCaptor.forClass(PersonajeVotoScore.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getPersonajeId()).isEqualTo(10L);
        assertThat(captor.getValue().getVotosScore()).isEqualTo(1.0d);
    }

    @Test
    void registraEmpateComoMedioPuntoParaCadaParticipante() {
        Personaje p1 = personaje(10L);
        Personaje p2 = personaje(20L);
        Enfrentamiento enfrentamiento = new Enfrentamiento();
        enfrentamiento.setPersonaje1(p1);
        enfrentamiento.setPersonaje2(p2);
        Voto empate = new Voto(p1, null, enfrentamiento);
        empate.setEmpate(true);
        PersonajeVotoScoreService sut = new PersonajeVotoScoreService(repository);
        when(repository.findByPersonajeIdForUpdate(any())).thenReturn(Optional.empty());

        sut.registrar(empate);

        ArgumentCaptor<PersonajeVotoScore> captor = ArgumentCaptor.forClass(PersonajeVotoScore.class);
        verify(repository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues())
                .extracting(PersonajeVotoScore::getPersonajeId, PersonajeVotoScore::getVotosScore)
                .containsExactlyInAnyOrder(
                        tuple(10L, 0.5d),
                        tuple(20L, 0.5d));
    }

    private static Personaje personaje(Long id) {
        Personaje personaje = new Personaje("p" + id, "P" + id, "Anime", "fixture", "/img/p" + id + ".webp");
        personaje.setId(id);
        return personaje;
    }
}
