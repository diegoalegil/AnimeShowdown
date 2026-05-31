package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;

import com.diegoalegil.animeshowdown.event.PrediccionResueltaEvent;
import com.diegoalegil.animeshowdown.model.*;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

@ExtendWith(MockitoExtension.class)
class PrediccionServiceTest {

    @Mock private PrediccionRepository prediccionRepository;
    @Mock private EnfrentamientoRepository enfRepo;
    @Mock private PersonajeRepository personajeRepo;
    @Mock private TorneoRepository torneoRepo;
    @Mock private ApplicationEventPublisher eventPublisher;

    private PrediccionService sut;
    private Usuario usuario;
    private Personaje personaje1;
    private Personaje personaje2;
    private Personaje predicho;
    private Personaje otro; // neither p1 nor p2
    private Torneo torneo;

    @BeforeEach
    void setUp() {
        sut = new PrediccionService(prediccionRepository, enfRepo, personajeRepo, torneoRepo, eventPublisher);
        usuario = new Usuario("testuser", "hash", "test@example.com");
        usuario.setId(1L);
        personaje1 = new Personaje("p1", "Personaje 1", "Anime A", "desc", "url1");
        personaje1.setId(10L);
        personaje2 = new Personaje("p2", "Personaje 2", "Anime B", "desc", "url2");
        personaje2.setId(20L);
        otro = new Personaje("p99", "Otro", "Anime X", "desc", "url99");
        otro.setId(99L);
        predicho = personaje1;
        torneo = new Torneo("test-torneo", "Test Torneo", "Fixture");
        torneo.setId(100L);
        torneo.setEstado(EstadoTorneo.IN_PROGRESS);
        torneo.setEstadoRevision(EstadoRevision.NO_APLICA);
    }

    private Enfrentamiento enf() {
        Enfrentamiento e = new Enfrentamiento(torneo, personaje1, personaje2);
        e.setId(50L);
        return e;
    }

    // --- aplicar() ---

    @Test
    void aplicarCreaNuevaPrediccionSiNoExiste() {
        when(enfRepo.findById(50L)).thenReturn(Optional.of(enf()));
        when(personajeRepo.findById(10L)).thenReturn(Optional.of(personaje1));
        when(prediccionRepository.findByUsuarioAndEnfrentamiento(eq(usuario), any()))
                .thenReturn(Optional.empty());
        when(prediccionRepository.save(any(Prediccion.class))).thenAnswer(i -> i.getArgument(0));

        Prediccion result = sut.aplicar(usuario, 50L, 10L);

        assertNotNull(result);
        verify(prediccionRepository).save(any(Prediccion.class));
    }

    @Test
    void aplicarActualizaPrediccionExistente() {
        Enfrentamiento e = enf();
        Prediccion existente = new Prediccion(usuario, e, personaje2);
        when(enfRepo.findById(50L)).thenReturn(Optional.of(e));
        when(personajeRepo.findById(10L)).thenReturn(Optional.of(personaje1));
        when(prediccionRepository.findByUsuarioAndEnfrentamiento(eq(usuario), any()))
                .thenReturn(Optional.of(existente));
        when(prediccionRepository.save(any(Prediccion.class))).thenAnswer(i -> i.getArgument(0));

        Prediccion result = sut.aplicar(usuario, 50L, 10L);

        assertEquals(personaje1, result.getPersonajePredicho());
    }

    @Test
    void aplicarLanzaSiEnfrentamientoNoExiste() {
        when(enfRepo.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 999L, 10L));
        assertEquals("Enfrentamiento no encontrado", ex.getMessage());
    }

    @Test
    void aplicarLanzaSiTorneoPendienteRevision() {
        torneo.setEstadoRevision(EstadoRevision.PENDIENTE);
        when(enfRepo.findById(50L)).thenReturn(Optional.of(enf()));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 50L, 10L));
        assertEquals("Enfrentamiento no encontrado", ex.getMessage());
    }

    @Test
    void aplicarLanzaSiTorneoRechazado() {
        torneo.setEstadoRevision(EstadoRevision.RECHAZADO);
        when(enfRepo.findById(50L)).thenReturn(Optional.of(enf()));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 50L, 10L));
        assertEquals("Enfrentamiento no encontrado", ex.getMessage());
    }

    @Test
    void aplicarLanzaSiTorneoFinalizado() {
        torneo.setEstado(EstadoTorneo.FINISHED);
        when(enfRepo.findById(50L)).thenReturn(Optional.of(enf()));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 50L, 10L));
        assertEquals("No puedes predecir en un torneo ya finalizado", ex.getMessage());
    }

    @Test
    void aplicarLanzaSiEnfrentamientoYaTieneGanador() {
        Enfrentamiento e = enf();
        e.setGanador(personaje1);
        when(enfRepo.findById(50L)).thenReturn(Optional.of(e));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 50L, 10L));
        assertEquals("Este enfrentamiento ya está resuelto", ex.getMessage());
    }

    @Test
    void aplicarLanzaSiEnfrentamientoSinRivales() {
        Enfrentamiento e = new Enfrentamiento(torneo, null, personaje2);
        e.setId(50L);
        when(enfRepo.findById(50L)).thenReturn(Optional.of(e));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 50L, 10L));
        assertEquals("El enfrentamiento todavía no tiene rivales asignados", ex.getMessage());
    }

    @Test
    void aplicarLanzaSiPersonajeNoPerteneceAlEnfrentamiento() {
        when(enfRepo.findById(50L)).thenReturn(Optional.of(enf()));
        // 99L is neither 10L nor 20L

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 50L, 99L));
        assertEquals("El personaje predicho no pertenece a este enfrentamiento", ex.getMessage());
    }

    @Test
    void aplicarLanzaSiPersonajeNoExiste() {
        when(enfRepo.findById(50L)).thenReturn(Optional.of(enf()));
        when(personajeRepo.findById(10L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicar(usuario, 50L, 10L));
        assertEquals("Personaje no encontrado", ex.getMessage());
    }

    @Test
    void aplicarCampeonCreaPrediccionDeTorneoAntesDelInicio() {
        torneo.setEstado(EstadoTorneo.SCHEDULED);
        when(torneoRepo.findById(100L)).thenReturn(Optional.of(torneo));
        when(personajeRepo.findById(10L)).thenReturn(Optional.of(personaje1));
        when(enfRepo.findByTorneoOrderedFetch(torneo)).thenReturn(List.of(enf()));
        when(prediccionRepository.findByUsuarioAndTorneoAndTipo(usuario, torneo, TipoPrediccion.CAMPEON))
                .thenReturn(Optional.empty());
        when(prediccionRepository.save(any(Prediccion.class))).thenAnswer(i -> i.getArgument(0));

        Prediccion result = sut.aplicarCampeon(usuario, 100L, 10L);

        assertEquals(TipoPrediccion.CAMPEON, result.getTipo());
        assertEquals(torneo, result.getTorneo());
        assertNull(result.getEnfrentamiento());
        assertEquals(personaje1, result.getPersonajePredicho());
    }

    @Test
    void aplicarCampeonLanzaSiTorneoYaArranco() {
        when(torneoRepo.findById(100L)).thenReturn(Optional.of(torneo));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.aplicarCampeon(usuario, 100L, 10L));

        assertEquals("Solo puedes predecir campeón antes de que arranque el torneo", ex.getMessage());
    }

    // --- listarPorUsuarioYTorneo() ---

    @Test
    void listarPorUsuarioYTorneoDelegaAlRepo() {
        Enfrentamiento e = enf();
        List<Prediccion> expected = List.of(new Prediccion(usuario, e, predicho));
        when(prediccionRepository.findByUsuarioAndTorneo(usuario, torneo)).thenReturn(expected);

        List<Prediccion> result = sut.listarPorUsuarioYTorneo(usuario, torneo);

        assertEquals(1, result.size());
    }

    // --- listarDtoPorUsuarioYTorneo() ---

    @Test
    void listarDtoPorUsuarioYTorneoMapeaADto() {
        Enfrentamiento e = enf();
        Prediccion p = new Prediccion(usuario, e, predicho);
        when(prediccionRepository.findByUsuarioAndTorneo(usuario, torneo)).thenReturn(List.of(p));

        var dtos = sut.listarDtoPorUsuarioYTorneo(usuario, torneo);

        assertEquals(1, dtos.size());
        assertEquals(10L, dtos.get(0).personajePredichoId());
    }

    // --- resolverParaTorneo() ---

    @Test
    void resolverParaTorneoMarcaAcertadaTrue() {
        // Create enfrent with winner = personaje1 so prediction matches
        Enfrentamiento e = new Enfrentamiento(torneo, personaje1, personaje2);
        e.setId(1L);
        e.setGanador(personaje1);
        Prediccion p = new Prediccion(usuario, e, personaje1); // predicted winner
        when(prediccionRepository.findByTorneo(torneo)).thenReturn(List.of(p));
        when(prediccionRepository.findResueltasDelUsuarioDesc(any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(prediccionRepository.save(any(Prediccion.class))).thenAnswer(i -> i.getArgument(0));

        int result = sut.resolverParaTorneo(torneo);

        assertEquals(1, result);
        assertTrue(p.getAcertada());
    }

    @Test
    void resolverParaTorneoMarcaAcertadaFalse() {
        Enfrentamiento e = new Enfrentamiento(torneo, personaje1, personaje2);
        e.setId(1L);
        e.setGanador(personaje1); // winner = p1
        Prediccion p = new Prediccion(usuario, e, personaje2); // predicted p2 (wrong)
        when(prediccionRepository.findByTorneo(torneo)).thenReturn(List.of(p));
        when(prediccionRepository.findResueltasDelUsuarioDesc(any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(prediccionRepository.save(any(Prediccion.class))).thenAnswer(i -> i.getArgument(0));

        int result = sut.resolverParaTorneo(torneo);

        assertEquals(1, result);
        assertFalse(p.getAcertada());
    }

    @Test
    void resolverParaTorneoSaltaPrediccionesYaResueltas() {
        Enfrentamiento e = enf();
        e.setGanador(personaje1);
        Prediccion p = new Prediccion(usuario, e, personaje1);
        p.setAcertada(true);
        when(prediccionRepository.findByTorneo(torneo)).thenReturn(List.of(p));

        int result = sut.resolverParaTorneo(torneo);

        assertEquals(1, result);
        verify(prediccionRepository, never()).save(any());
    }

    @Test
    void resolverParaTorneoSaltaMatchesSinGanador() {
        Enfrentamiento e = enf();
        e.setGanador(null);
        Prediccion p = new Prediccion(usuario, e, personaje1);
        when(prediccionRepository.findByTorneo(torneo)).thenReturn(List.of(p));

        int result = sut.resolverParaTorneo(torneo);

        assertEquals(0, result);
        assertNull(p.getAcertada());
    }

    @Test
    void resolverParaTorneoMarcaCampeonAcertadoContraGanadorFinal() {
        torneo.setGanadorPersonaje(personaje1);
        Prediccion p = new Prediccion(usuario, torneo, personaje1);
        when(prediccionRepository.findByTorneo(torneo)).thenReturn(List.of(p));
        when(prediccionRepository.findResueltasDelUsuarioDesc(any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(prediccionRepository.save(any(Prediccion.class))).thenAnswer(i -> i.getArgument(0));

        int result = sut.resolverParaTorneo(torneo);

        assertEquals(1, result);
        assertTrue(p.getAcertada());
    }

    @Test
    void resolverParaTorneoPublicaEventoPorUsuario() {
        Enfrentamiento e = new Enfrentamiento(torneo, personaje1, personaje2);
        e.setId(1L);
        e.setGanador(personaje1);
        Prediccion p = new Prediccion(usuario, e, personaje1);
        when(prediccionRepository.findByTorneo(torneo)).thenReturn(List.of(p));
        when(prediccionRepository.findResueltasDelUsuarioDesc(any(), any(Pageable.class)))
                .thenReturn(List.of(p));
        when(prediccionRepository.countByUsuarioAndAcertadaTrue(any())).thenReturn(1L);
        when(prediccionRepository.save(any(Prediccion.class))).thenAnswer(i -> i.getArgument(0));

        sut.resolverParaTorneo(torneo);

        ArgumentCaptor<PrediccionResueltaEvent> captor = ArgumentCaptor.forClass(PrediccionResueltaEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertEquals(1L, captor.getValue().usuarioId());
        assertEquals(1, captor.getValue().rachaConsecutivaActual());
        assertEquals(1L, captor.getValue().totalAciertos());
    }

    // --- leaderboard() ---

    @Test
    void leaderboardDevuelveRankingOrdenado() {
        Object[] fila = new Object[]{1L, "user1", 5L};
        ArrayList<Object[]> filas = new ArrayList<>();
        filas.add(fila);
        when(prediccionRepository.leaderboardDesde(any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(filas);

        List<Map<String, Object>> result = sut.leaderboard(30, 10);

        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).get("usuarioId"));
        assertEquals("user1", result.get(0).get("username"));
        assertEquals(5L, result.get(0).get("aciertos"));
    }

    @Test
    void leaderboardLimitaA100Max() {
        when(prediccionRepository.leaderboardDesde(any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(new ArrayList<>());

        sut.leaderboard(30, 500);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(prediccionRepository).leaderboardDesde(any(LocalDateTime.class), captor.capture());
        assertEquals(0, captor.getValue().getPageNumber());
        assertEquals(100, captor.getValue().getPageSize());
    }
}
