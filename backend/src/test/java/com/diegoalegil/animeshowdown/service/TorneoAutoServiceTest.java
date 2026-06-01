package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.EventoFiltroKind;
import com.diegoalegil.animeshowdown.model.EventoTematico;
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
    @Mock private EventoTematicoService eventoTematicoService;

    private TorneoAutoService service;

    @BeforeEach
    void setUp() {
        service = new TorneoAutoService(
                torneoRepository,
                personajeRepository,
                bracketService,
                indexNowService,
                notificacionService,
                eventoTematicoService,
                true);
        lenient().when(torneoRepository.findTorneoAutoMasRecienteDesde(any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        lenient().when(torneoRepository.findTorneoMasRecientePorNombrePrefixDesde(anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> {
            Torneo torneo = inv.getArgument(0);
            torneo.setId(77L);
            return torneo;
        });
        lenient().when(bracketService.crearBracket(any(Torneo.class), any()))
                .thenReturn(List.<Enfrentamiento>of());
    }

    @Test
    void generaCopaTematicaDesdeEventoActivo() {
        EventoTematico evento = evento("copa-villanos", "Copa Villanos");
        List<Personaje> participantes = personajes(8);
        when(eventoTematicoService.eventoActivoParaCopa(any(LocalDateTime.class)))
                .thenReturn(Optional.of(evento));
        when(eventoTematicoService.seleccionarParticipantes(evento, 8))
                .thenReturn(participantes);
        when(torneoRepository.countAutoGeneradosByEventoSlug("copa-villanos"))
                .thenReturn(0L);
        when(torneoRepository.existsBySlug("copa-villanos-1")).thenReturn(false);

        Torneo creado = service.generar(8, false);

        assertThat(creado.getNombre()).isEqualTo("Copa Villanos #1");
        assertThat(creado.getSlug()).isEqualTo("copa-villanos-1");
        assertThat(creado.getEstado()).isEqualTo(EstadoTorneo.IN_PROGRESS);
        assertThat(creado.isAutoGenerado()).isTrue();
        assertThat(creado.getAutoOrigen()).isEqualTo("EVENTO");
        assertThat(creado.getEventoSlug()).isEqualTo("copa-villanos");
        verify(personajeRepository, never()).findRandom(anyInt());
        verify(bracketService).crearBracket(creado, participantes);
    }

    @Test
    void caeARandomSiNoHayEventoActivo() {
        when(eventoTematicoService.eventoActivoParaCopa(any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(personajeRepository.findRandom(8)).thenReturn(personajes(8));
        when(torneoRepository.countByNombrePrefix("Random Showdown #")).thenReturn(4L);
        when(torneoRepository.existsBySlug("random-showdown-5")).thenReturn(false);

        Torneo creado = service.generar(8, false);

        assertThat(creado.getNombre()).isEqualTo("Random Showdown #5");
        assertThat(creado.getAutoOrigen()).isEqualTo("RANDOM");
        assertThat(creado.getEventoSlug()).isNull();
    }

    @Test
    void bodyPuedeForzarEventoConcreto() {
        EventoTematico evento = evento("semana-one-piece", "Copa One Piece");
        when(eventoTematicoService.buscarActivoParaCopa("semana-one-piece"))
                .thenReturn(Optional.of(evento));
        when(eventoTematicoService.seleccionarParticipantes(evento, 8))
                .thenReturn(personajes(8));
        when(torneoRepository.countAutoGeneradosByEventoSlug("semana-one-piece"))
                .thenReturn(2L);
        when(torneoRepository.existsBySlug("copa-one-piece-3")).thenReturn(false);

        service.generar(8, true, "semana-one-piece");

        ArgumentCaptor<Torneo> captor = ArgumentCaptor.forClass(Torneo.class);
        verify(torneoRepository).save(captor.capture());
        assertThat(captor.getValue().getNombre()).isEqualTo("Copa One Piece #3");
        assertThat(captor.getValue().getEventoSlug()).isEqualTo("semana-one-piece");
    }

    private static EventoTematico evento(String slug, String cupNombre) {
        EventoTematico evento = new EventoTematico();
        evento.setSlug(slug);
        evento.setTitulo(cupNombre);
        evento.setDescripcionCorta("Evento runtime");
        evento.setFiltroKind(EventoFiltroKind.SLUGS);
        evento.setFiltroValor("p1,p2,p3,p4,p5,p6,p7,p8");
        evento.setInicio(LocalDateTime.now().minusDays(1));
        evento.setFin(LocalDateTime.now().plusDays(1));
        evento.setCupEnabled(true);
        evento.setCupSize(8);
        evento.setCupNombre(cupNombre);
        return evento;
    }

    private static List<Personaje> personajes(int total) {
        return java.util.stream.IntStream.rangeClosed(1, total)
                .mapToObj(i -> {
                    Personaje p = new Personaje();
                    p.setId((long) i);
                    p.setSlug("p" + i);
                    p.setNombre("P" + i);
                    p.setAnime("Anime");
                    return p;
                })
                .toList();
    }
}
