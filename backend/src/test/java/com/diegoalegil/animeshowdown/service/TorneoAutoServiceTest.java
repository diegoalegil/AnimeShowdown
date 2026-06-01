package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

@ExtendWith(MockitoExtension.class)
class TorneoAutoServiceTest {

    @Mock private TorneoRepository torneoRepository;
    @Mock private PersonajeRepository personajeRepository;
    @Mock private BracketService bracketService;
    @Mock private IndexNowService indexNowService;
    @Mock private NotificacionService notificacionService;
    @Mock private TorneoCreationLock torneoCreationLock;

    private TorneoAutoService service;

    @BeforeEach
    void setUp() {
        service = new TorneoAutoService(
                torneoRepository,
                personajeRepository,
                bracketService,
                indexNowService,
                notificacionService,
                torneoCreationLock,
                true);
    }

    @Test
    void generarSerializaAntesDeRevisarVentanaYContador() {
        when(torneoRepository.findTorneoMasRecientePorNombrePrefixDesde(any(), any()))
                .thenReturn(Optional.empty());
        when(personajeRepository.findRandom(8)).thenReturn(personajes(8));
        when(torneoRepository.countByNombrePrefix("Random Showdown #")).thenReturn(7L);
        when(torneoRepository.saveAndFlush(any(Torneo.class))).thenAnswer(inv -> {
            Torneo torneo = inv.getArgument(0);
            torneo.setId(42L);
            return torneo;
        });
        when(bracketService.crearBracket(any(Torneo.class), any())).thenReturn(List.<Enfrentamiento>of());

        Torneo creado = service.generar(8, false);

        assertThat(creado.getSlug()).isEqualTo("random-showdown-8");
        var orden = org.mockito.Mockito.inOrder(torneoCreationLock, torneoRepository, personajeRepository);
        orden.verify(torneoCreationLock).bloquearCreacionTorneos();
        orden.verify(torneoRepository).findTorneoMasRecientePorNombrePrefixDesde(any(), any());
        orden.verify(personajeRepository).findRandom(8);
        orden.verify(torneoRepository).countByNombrePrefix("Random Showdown #");
        orden.verify(torneoRepository).saveAndFlush(any(Torneo.class));
    }

    @Test
    void noTomaLockSiLaFeatureEstaDeshabilitada() {
        TorneoAutoService disabled = new TorneoAutoService(
                torneoRepository,
                personajeRepository,
                bracketService,
                indexNowService,
                notificacionService,
                torneoCreationLock,
                false);

        org.junit.jupiter.api.Assertions.assertThrows(
                IllegalStateException.class,
                () -> disabled.generar(8, false));

        verifyNoInteractions(torneoCreationLock);
    }

    private static List<Personaje> personajes(int total) {
        return java.util.stream.LongStream.rangeClosed(1, total)
                .mapToObj(id -> {
                    Personaje personaje = new Personaje();
                    personaje.setId(id);
                    personaje.setSlug("p" + id);
                    personaje.setNombre("P" + id);
                    personaje.setAnime("Anime");
                    return personaje;
                })
                .toList();
    }
}
