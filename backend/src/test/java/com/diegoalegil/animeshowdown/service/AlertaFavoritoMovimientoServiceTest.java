package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PersonajeFavoritoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@ExtendWith(MockitoExtension.class)
class AlertaFavoritoMovimientoServiceTest {

    @Mock private PersonajeFavoritoRepository favoritoRepository;
    @Mock private PersonajeRepository personajeRepository;
    @Mock private RankingMovimientosService rankingMovimientosService;
    @Mock private NotificacionService notificacionService;

    private AlertaFavoritoMovimientoService service;

    private static final int UMBRAL = 15;
    private static final int VENTANA = 7;
    // Reloj fijo para que el día de la eventoKey sea determinista.
    private final Clock clock = Clock.fixed(Instant.parse("2026-06-02T09:00:00Z"), ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        service = new AlertaFavoritoMovimientoService(
                favoritoRepository, personajeRepository, rankingMovimientosService,
                notificacionService, clock, UMBRAL, VENTANA);
    }

    private Personaje personaje(String slug, String nombre) {
        Personaje p = mock(Personaje.class);
        when(p.getSlug()).thenReturn(slug);
        when(p.getNombre()).thenReturn(nombre);
        return p;
    }

    @Test
    void notificaSubidaYBajadaSignificativas_eIgnoraMovimientoPequeno() {
        when(favoritoRepository.findPersonajeIdsConSeguidores()).thenReturn(List.of(1L, 2L, 3L));
        // 1 subió 20 (>=15), 2 sólo 3 (<15 → ignorado), 3 bajó 18 (>=15).
        when(rankingMovimientosService.calcularDeltasPosicion(
                anyCollection(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Map.of(1L, 20, 2L, 3, 3L, -18));
        Personaje luffy = personaje("luffy", "Luffy");
        Personaje zoro = personaje("zoro", "Zoro");
        when(personajeRepository.findById(1L)).thenReturn(java.util.Optional.of(luffy));
        when(personajeRepository.findById(3L)).thenReturn(java.util.Optional.of(zoro));
        when(favoritoRepository.findUsuariosByPersonajeId(eq(1L), any()))
                .thenReturn(List.of(mock(Usuario.class), mock(Usuario.class)));
        when(favoritoRepository.findUsuariosByPersonajeId(eq(3L), any()))
                .thenReturn(List.of(mock(Usuario.class)));
        when(notificacionService.crearSiNoExiste(
                any(), eq(NotificacionTipo.FAVORITO_MOVIMIENTO),
                anyString(), anyString(), anyString(), anyString()))
                .thenReturn(true);

        int creadas = service.notificarMovimientos();

        // 2 seguidores de Luffy + 1 de Zoro = 3 notificaciones.
        assertThat(creadas).isEqualTo(3);
        // El personaje con movimiento por debajo del umbral nunca se procesa.
        verify(favoritoRepository, never()).findUsuariosByPersonajeId(eq(2L), any());
        verify(personajeRepository, never()).findById(2L);

        ArgumentCaptor<String> titulo = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> eventoKey = ArgumentCaptor.forClass(String.class);
        verify(notificacionService, org.mockito.Mockito.times(3)).crearSiNoExiste(
                any(), eq(NotificacionTipo.FAVORITO_MOVIMIENTO),
                titulo.capture(), anyString(), anyString(), eventoKey.capture());

        // Subida de Luffy: copy "subiendo" + eventoKey idempotente por día/dirección.
        assertThat(eventoKey.getAllValues()).contains("fav-mov:1:2026-06-02:up");
        // Bajada de Zoro.
        assertThat(eventoKey.getAllValues()).contains("fav-mov:3:2026-06-02:down");
        assertThat(titulo.getAllValues()).anyMatch(t -> t.contains("Luffy") && t.contains("subiendo"));
        assertThat(titulo.getAllValues()).anyMatch(t -> t.contains("Zoro") && t.contains("bajando"));
    }

    @Test
    void noHaceNadaSiNadieTieneFavoritos() {
        when(favoritoRepository.findPersonajeIdsConSeguidores()).thenReturn(List.of());

        int creadas = service.notificarMovimientos();

        assertThat(creadas).isZero();
        verifyNoInteractions(rankingMovimientosService, notificacionService, personajeRepository);
    }

    @Test
    void duplicadosIdempotentesNoCuentan() {
        when(favoritoRepository.findPersonajeIdsConSeguidores()).thenReturn(List.of(1L));
        when(rankingMovimientosService.calcularDeltasPosicion(
                anyCollection(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Map.of(1L, 20));
        Personaje luffy = personaje("luffy", "Luffy");
        when(personajeRepository.findById(1L)).thenReturn(java.util.Optional.of(luffy));
        when(favoritoRepository.findUsuariosByPersonajeId(eq(1L), any()))
                .thenReturn(List.of(mock(Usuario.class), mock(Usuario.class)));
        // El primero es nuevo (true), el segundo ya existía (false → idempotente).
        when(notificacionService.crearSiNoExiste(
                any(), eq(NotificacionTipo.FAVORITO_MOVIMIENTO),
                anyString(), anyString(), anyString(), anyString()))
                .thenReturn(true, false);

        int creadas = service.notificarMovimientos();

        assertThat(creadas).isEqualTo(1);
    }
}
