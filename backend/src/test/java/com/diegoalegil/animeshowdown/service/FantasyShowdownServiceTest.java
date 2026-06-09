package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.FantasyDraftRequest;
import com.diegoalegil.animeshowdown.model.FantasyEquipo;
import com.diegoalegil.animeshowdown.model.FantasyEquipoItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.FantasyEquipoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(MockitoExtension.class)
class FantasyShowdownServiceTest {

    @Mock private FantasyEquipoRepository equipoRepository;
    @Mock private PersonajeRepository personajeRepository;
    @Mock private UsuarioRepository usuarioRepository;
    @Mock private VotoRepository votoRepository;
    @Mock private RankingMovimientosService rankingMovimientosService;
    @Mock private PersonajeScoreQueryService personajeScoreQueryService;

    private FantasyShowdownService sut;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-27T12:00:00Z"), ZoneOffset.UTC);
        sut = new FantasyShowdownService(
                equipoRepository,
                personajeRepository,
                usuarioRepository,
                votoRepository,
                rankingMovimientosService,
                personajeScoreQueryService,
                clock,
                1000);
        usuario = new Usuario("fantasy_user", "hash", "fantasy@example.com");
        usuario.setId(1L);
    }

    @Test
    void guardarDraftRechazaOverspend() {
        List<Long> ids = List.of(1L, 2L, 3L, 4L, 5L);
        when(equipoRepository.findByUsuarioAndSemanaIsoForUpdate(usuario, "2026-W22"))
                .thenReturn(Optional.empty());
        when(usuarioRepository.findForUpdateById(usuario.getId())).thenReturn(Optional.of(usuario));
        when(personajeRepository.findAllById(ids)).thenReturn(ids.stream().map(this::personaje).toList());
        when(votoRepository.votosPorPersonajes()).thenReturn(ids.stream()
                .map(id -> new Object[]{id, 100L})
                .toList());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> sut.guardarDraft(usuario, new FantasyDraftRequest(ids)));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(equipoRepository, never()).save(any());
    }

    @Test
    void guardarDraftInicialBloqueaUsuarioAntesDeCrearEquipo() {
        List<Long> ids = List.of(1L, 2L, 3L, 4L, 5L);
        when(equipoRepository.findByUsuarioAndSemanaIsoForUpdate(usuario, "2026-W22"))
                .thenReturn(Optional.empty());
        when(usuarioRepository.findForUpdateById(usuario.getId())).thenReturn(Optional.of(usuario));
        when(personajeRepository.findAllById(ids)).thenReturn(ids.stream().map(this::personaje).toList());
        when(votoRepository.votosPorPersonajes()).thenReturn(ids.stream()
                .map(id -> new Object[]{id, 0L})
                .toList());
        when(equipoRepository.save(any(FantasyEquipo.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        sut.guardarDraft(usuario, new FantasyDraftRequest(ids));

        InOrder inOrder = inOrder(equipoRepository, usuarioRepository);
        inOrder.verify(equipoRepository).findByUsuarioAndSemanaIsoForUpdate(usuario, "2026-W22");
        inOrder.verify(usuarioRepository).findForUpdateById(usuario.getId());
        inOrder.verify(equipoRepository).findByUsuarioAndSemanaIsoForUpdate(usuario, "2026-W22");
        inOrder.verify(equipoRepository).save(any(FantasyEquipo.class));
    }

    @Test
    void guardarDraftRechazaCambiosSiEquipoEstaLocked() {
        FantasyEquipo equipo = new FantasyEquipo(usuario, "2026-W22");
        equipo.setLockedAt(LocalDateTime.parse("2026-05-26T00:00:00"));
        when(equipoRepository.findByUsuarioAndSemanaIsoForUpdate(usuario, "2026-W22"))
                .thenReturn(Optional.of(equipo));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> sut.guardarDraft(usuario, new FantasyDraftRequest(List.of(1L, 2L, 3L, 4L, 5L))));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(personajeRepository, never()).findAllById(anyCollection());
    }

    @Test
    void cerrarSemanaCalculaPuntosComoSumaDeDeltas() {
        FantasyEquipo equipo = equipoConItems(usuario, "2026-W21", List.of(1L, 2L, 3L, 4L, 5L));
        equipo.setLockedAt(LocalDateTime.parse("2026-05-19T00:00:00"));
        when(equipoRepository.findBySemanaIsoAndLockedAtIsNotNull("2026-W21"))
                .thenReturn(List.of(equipo));
        when(rankingMovimientosService.calcularDeltasPosicion(
                anyCollection(),
                any(LocalDateTime.class),
                any(LocalDateTime.class)))
                .thenReturn(Map.of(1L, 4, 2L, -2, 3L, 0, 4L, 7, 5L, 1));

        int cerrados = sut.cerrarSemana("2026-W21");

        assertEquals(1, cerrados);
        assertEquals(10, equipo.getPuntos());
        assertNotNull(equipo.getPuntosCalculadosAt());
        verify(equipoRepository).save(equipo);
    }

    @Test
    void leaderboardOrdenaPorPuntosSemanales() {
        Usuario a = usuario;
        Usuario b = new Usuario("fantasy_rival", "hash", "rival@example.com");
        b.setId(2L);
        FantasyEquipo equipoA = equipoConItems(a, "2026-W22", List.of(1L, 2L, 3L, 4L, 5L));
        FantasyEquipo equipoB = equipoConItems(b, "2026-W22", List.of(6L, 7L, 8L, 9L, 10L));
        equipoA.setLockedAt(LocalDateTime.parse("2026-05-26T00:00:00"));
        equipoB.setLockedAt(LocalDateTime.parse("2026-05-26T00:00:00"));
        when(equipoRepository.findBySemanaIsoAndLockedAtIsNotNull("2026-W22"))
                .thenReturn(List.of(equipoA, equipoB));
        when(rankingMovimientosService.calcularDeltasPosicion(
                anyCollection(),
                any(LocalDateTime.class),
                any(LocalDateTime.class)))
                .thenReturn(Map.of(
                        1L, 1, 2L, 1, 3L, 0, 4L, 0, 5L, 0,
                        6L, 3, 7L, 3, 8L, 2, 9L, 0, 10L, 0));

        var leaderboard = sut.leaderboard("2026-W22", 10);

        assertEquals("fantasy_rival", leaderboard.get(0).username());
        assertEquals(8, leaderboard.get(0).puntos());
        assertEquals("fantasy_user", leaderboard.get(1).username());
        assertEquals(2, leaderboard.get(1).puntos());
    }

    @Test
    void eloEstimadoUsaSemillaCanonicaYActividadComunitaria() {
        assertEquals(1824, FantasyShowdownService.eloEstimado(1824, 0.0));
        assertEquals(1956, FantasyShowdownService.eloEstimado(1824, 42.0));
    }

    private FantasyEquipo equipoConItems(Usuario user, String semana, List<Long> ids) {
        FantasyEquipo equipo = new FantasyEquipo(user, semana);
        equipo.reemplazarItems(ids.stream()
                .map(id -> new FantasyEquipoItem(personaje(id), 100))
                .toList());
        return equipo;
    }

    private Personaje personaje(Long id) {
        Personaje p = new Personaje("p" + id, "Personaje " + id, "Anime", "desc", "/img/p" + id + ".webp");
        p.setId(id);
        return p;
    }
}
