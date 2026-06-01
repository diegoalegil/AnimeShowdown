package com.diegoalegil.animeshowdown.config;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.DueloLiveRondaRepository;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.FantasyEquipoItemRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import com.diegoalegil.animeshowdown.service.BracketService;
import com.diegoalegil.animeshowdown.service.CartaCatalogoService;
import com.diegoalegil.animeshowdown.service.ReferralService;
import com.fasterxml.jackson.databind.ObjectMapper;

class DataSeederFantasyCleanupUnitTest {

    @Test
    void limpiaItemsFantasyAntesDeBorrarPersonaje() {
        PersonajeRepository personajeRepository = mock(PersonajeRepository.class);
        VotoRepository votoRepository = mock(VotoRepository.class);
        EnfrentamientoRepository enfrentamientoRepository = mock(EnfrentamientoRepository.class);
        TorneoRepository torneoRepository = mock(TorneoRepository.class);
        PrediccionRepository prediccionRepository = mock(PrediccionRepository.class);
        DueloLiveRondaRepository dueloLiveRondaRepository = mock(DueloLiveRondaRepository.class);
        FantasyEquipoItemRepository fantasyEquipoItemRepository = mock(FantasyEquipoItemRepository.class);

        Personaje personaje = new Personaje();
        personaje.setId(99L);
        personaje.setSlug("retirado");
        when(fantasyEquipoItemRepository.deleteByPersonajeId(99L)).thenReturn(1);

        DataSeeder seeder = new DataSeeder(
                personajeRepository,
                votoRepository,
                enfrentamientoRepository,
                torneoRepository,
                prediccionRepository,
                dueloLiveRondaRepository,
                fantasyEquipoItemRepository,
                mock(BracketService.class),
                mock(ReferralService.class),
                mock(CartaCatalogoService.class),
                mock(ObjectMapper.class));

        seeder.borrarPersonajeConCascadaPublic(personaje);

        InOrder order = inOrder(
                prediccionRepository,
                torneoRepository,
                fantasyEquipoItemRepository,
                votoRepository,
                enfrentamientoRepository,
                dueloLiveRondaRepository,
                personajeRepository
        );
        order.verify(prediccionRepository).deleteByPersonajePredichoId(99L);
        order.verify(torneoRepository).clearGanadorByPersonajeId(99L);
        order.verify(fantasyEquipoItemRepository).deleteByPersonajeId(99L);
        order.verify(votoRepository).deleteByPersonajeId(99L);
        order.verify(votoRepository).deleteVotosEnEnfrentamientosDelPersonaje(99L);
        order.verify(enfrentamientoRepository).deleteByPersonajeId(99L);
        order.verify(dueloLiveRondaRepository).deleteByPersonajeId(99L);
        order.verify(personajeRepository).delete(personaje);
    }
}
