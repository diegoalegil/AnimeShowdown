package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.EventoTematico;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EventoRecompensaEntregadaRepository;
import com.diegoalegil.animeshowdown.repository.EventoTematicoRepository;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@ExtendWith(MockitoExtension.class)
class EventoRecompensaServiceTest {

    @Mock private EventoTematicoRepository eventoRepository;
    @Mock private PrediccionRepository prediccionRepository;
    @Mock private EventoRecompensaEntregadaRepository entregadaRepository;
    @Mock private UsuarioRepository usuarioRepository;
    @Mock private MonederoService monederoService;
    @Mock private BadgeService badgeService;
    @Mock private CartaService cartaService;
    @Mock private AuditLogService auditLogService;

    private EventoRecompensaService sut() {
        return new EventoRecompensaService(eventoRepository, prediccionRepository,
                entregadaRepository, usuarioRepository, monederoService, badgeService,
                cartaService, auditLogService);
    }

    private static Torneo copaDeEvento(String slug) {
        Torneo torneo = new Torneo();
        torneo.setId(100L);
        torneo.setEventoSlug(slug);
        return torneo;
    }

    private static EventoTematico eventoConLas4(String slug) {
        EventoTematico evento = new EventoTematico();
        evento.setSlug(slug);
        evento.setTitulo("Copa Chainsaw");
        evento.setRecompensaMoneda(120);
        evento.setRecompensaCartaEspecialSlug("makima");
        evento.setRecompensaBadgeCodigo("campeon_evento");
        evento.setRecompensaSobreGratis(true);
        return evento;
    }

    @Test
    void referenciaYOrigenSeAcotanCuandoElSlugDelEventoEsLargo() {
        // Slug largo: "evento:"+slug+":"+ids desborda monedero_movimiento.referencia(96)
        // y "evento:"+slug desborda sobre_gratis_credito.origen(80); se acota con hash
        // (antes la recompensa fallaba en silencio y cada re-finalize reintentaba).
        String slugLargo = "a".repeat(80);
        Torneo torneo = copaDeEvento(slugLargo);
        EventoTematico evento = eventoConLas4(slugLargo);
        Usuario u = new Usuario("u", "h", "u@example.com");
        u.setId(987654L);

        assertTrue(EventoRecompensaService.referenciaEvento(evento, torneo, u).length() <= 96);
        assertTrue(EventoRecompensaService.origenEvento(evento).length() <= 80);
    }

    @Test
    void repartirPremiaATodosLosQuePredijeronConLas4Recompensas() {
        Torneo torneo = copaDeEvento("chainsaw");
        EventoTematico evento = eventoConLas4("chainsaw");
        Usuario u = new Usuario("predijo", "h", "p@example.com");
        u.setId(7L);

        when(eventoRepository.findBySlug("chainsaw")).thenReturn(Optional.of(evento));
        when(prediccionRepository.findDistinctUsuarioIdsByTorneo(torneo)).thenReturn(List.of(7L));
        when(usuarioRepository.findAllById(List.of(7L))).thenReturn(List.of(u));
        when(entregadaRepository.existsByTorneoIdAndUsuarioId(100L, 7L)).thenReturn(false);

        int premiados = sut().repartirPorTorneoFinalizado(torneo);

        assertEquals(1, premiados);
        verify(monederoService).acreditar(eq(u), eq(MotivoMovimiento.RECOMPENSA_EVENTO),
                eq("evento:chainsaw:100:7"), eq(120L));
        verify(cartaService).concederCartaEspecialPorSlug(u, "makima");
        verify(badgeService).desbloquear(u, "campeon_evento");
        verify(cartaService).otorgarCreditoSobre(eq(7L), eq("evento:chainsaw"),
                eq("evento:chainsaw:100:7"), anyString());
        verify(entregadaRepository).saveAndFlush(any());
    }

    @Test
    void repartirEsIdempotenteSiYaSePremioAlUsuario() {
        Torneo torneo = copaDeEvento("chainsaw");
        EventoTematico evento = eventoConLas4("chainsaw");
        Usuario u = new Usuario("yapremiado", "h", "y@example.com");
        u.setId(7L);

        when(eventoRepository.findBySlug("chainsaw")).thenReturn(Optional.of(evento));
        when(prediccionRepository.findDistinctUsuarioIdsByTorneo(torneo)).thenReturn(List.of(7L));
        when(usuarioRepository.findAllById(List.of(7L))).thenReturn(List.of(u));
        when(entregadaRepository.existsByTorneoIdAndUsuarioId(100L, 7L)).thenReturn(true);

        int premiados = sut().repartirPorTorneoFinalizado(torneo);

        assertEquals(0, premiados);
        verify(monederoService, never()).acreditar(any(), any(), anyString(), anyLong());
        verify(entregadaRepository, never()).saveAndFlush(any());
    }

    @Test
    void torneoSinEventoNoRepartoNada() {
        Torneo torneo = new Torneo();
        torneo.setId(100L);

        int premiados = sut().repartirPorTorneoFinalizado(torneo);

        assertEquals(0, premiados);
        verifyNoInteractions(eventoRepository, prediccionRepository, usuarioRepository,
                monederoService, badgeService, cartaService);
    }

    @Test
    void eventoSinRecompensasConfiguradasNoRepartoNada() {
        Torneo torneo = copaDeEvento("seco");
        EventoTematico evento = new EventoTematico();
        evento.setSlug("seco");

        when(eventoRepository.findBySlug("seco")).thenReturn(Optional.of(evento));

        int premiados = sut().repartirPorTorneoFinalizado(torneo);

        assertEquals(0, premiados);
        verifyNoInteractions(prediccionRepository, usuarioRepository, monederoService,
                badgeService, cartaService);
    }
}
