package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;
import com.diegoalegil.animeshowdown.repository.SobreAperturaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaPityRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.persistence.EntityManager;

@ExtendWith(MockitoExtension.class)
class CartaServiceTest {

    @Mock private CartaRepository cartaRepository;
    @Mock private UsuarioCartaRepository usuarioCartaRepository;
    @Mock private UsuarioCartaPityRepository pityRepository;
    @Mock private SobreAperturaRepository sobreAperturaRepository;
    @Mock private MonederoMovimientoRepository movimientoRepository;
    @Mock private VotoRepository votoRepository;
    @Mock private MonederoService monederoService;
    @Mock private RarezaService rarezaService;
    @Mock private AuditLogService auditLogService;
    @Mock private EntityManager entityManager;

    private CartaService sut;

    @BeforeEach
    void setUp() {
        sut = new CartaService(
                cartaRepository,
                usuarioCartaRepository,
                pityRepository,
                sobreAperturaRepository,
                movimientoRepository,
                votoRepository,
                monederoService,
                rarezaService,
                auditLogService,
                entityManager,
                10L,
                50L);
    }

    @Test
    void coleccionAceptaScoresDecimalesPorEmpateNeutral() {
        Usuario usuario = new Usuario("cartas_decimal", "hash", "cartas_decimal@example.com");
        usuario.setId(1L);
        Personaje personaje = new Personaje("goku", "Goku", "Dragon Ball", "desc", "/img/goku.webp");
        personaje.setId(10L);
        Carta carta = new Carta(personaje, RarezaCarta.SSR);
        carta.setId(100L);

        when(cartaRepository.findAllByOrderByIdAsc()).thenReturn(List.of(carta));
        when(usuarioCartaRepository.findByUsuarioOrderByObtenidaEnDesc(usuario))
                .thenReturn(List.of(new UsuarioCarta(usuario, carta)));
        when(votoRepository.votosPorPersonajes()).thenReturn(List.<Object[]>of(new Object[]{10L, 0.5d}));
        when(monederoService.saldoDe(usuario)).thenReturn(0L);
        when(pityRepository.findById(usuario.getId())).thenReturn(Optional.empty());
        when(rarezaService.pityDuro()).thenReturn(10);
        when(movimientoRepository.existsByUsuarioAndMotivoAndReferencia(
                eq(usuario), eq(MotivoMovimiento.COFRE_DIARIO), anyString()))
                .thenReturn(false);

        ColeccionDto coleccion = sut.coleccion(usuario);

        assertEquals(1, coleccion.totalPoseidas());
        assertEquals(1L, coleccion.cartas().getFirst().elo());
    }
}
