package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
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
import com.diegoalegil.animeshowdown.model.UsuarioCartaPity;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;
import com.diegoalegil.animeshowdown.repository.SobreAperturaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaPityRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
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
    @Mock private UsuarioRepository usuarioRepository;
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
                usuarioRepository,
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

    @Test
    void primerSobreBloqueaUsuarioAntesDeCrearPity() {
        Usuario usuario = new Usuario("cartas_race", "hash", "cartas_race@example.com");
        usuario.setId(7L);
        Personaje personaje = new Personaje("luffy", "Luffy", "One Piece", "desc", "/img/luffy.webp");
        personaje.setId(70L);
        Carta normal = carta(personaje, 1L, RarezaCarta.SSR);
        Carta climax = carta(personaje, 2L, RarezaCarta.SSR);
        UsuarioCartaPity nuevaPity = new UsuarioCartaPity(usuario);

        when(sobreAperturaRepository.findByUsuarioAndIdempotencyKey(usuario, "idem-race"))
                .thenReturn(Optional.empty());
        when(pityRepository.findForUpdateByUsuarioId(usuario.getId()))
                .thenReturn(Optional.empty());
        when(usuarioRepository.findForUpdateById(usuario.getId())).thenReturn(Optional.of(usuario));
        when(entityManager.getReference(Usuario.class, usuario.getId())).thenReturn(usuario);
        when(pityRepository.saveAndFlush(org.mockito.ArgumentMatchers.any(UsuarioCartaPity.class)))
                .thenReturn(nuevaPity);
        when(rarezaService.precioSobre()).thenReturn(100L);
        when(rarezaService.debeSalirEspecial(0)).thenReturn(false);
        when(rarezaService.elegirSobre(false))
                .thenReturn(new RarezaService.SobreDraw(List.of(normal, normal, normal, normal), climax, false));
        when(monederoService.debitar(usuario, MotivoMovimiento.COMPRA_SOBRE, "sobre:idem-race", 100L))
                .thenReturn(900L);
        when(usuarioCartaRepository.findByUsuarioAndCarta(eq(usuario), org.mockito.ArgumentMatchers.any(Carta.class)))
                .thenReturn(Optional.empty());
        when(votoRepository.votosPorPersonajes()).thenReturn(List.of());
        when(sobreAperturaRepository.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        sut.abrirSobre(usuario, "idem-race");

        var order = inOrder(pityRepository, usuarioRepository);
        order.verify(pityRepository).findForUpdateByUsuarioId(usuario.getId());
        order.verify(usuarioRepository).findForUpdateById(usuario.getId());
        order.verify(pityRepository).findForUpdateByUsuarioId(usuario.getId());
        order.verify(pityRepository).saveAndFlush(org.mockito.ArgumentMatchers.any(UsuarioCartaPity.class));
    }

    private static Carta carta(Personaje personaje, Long id, RarezaCarta rareza) {
        Carta carta = new Carta(personaje, rareza);
        carta.setId(id);
        return carta;
    }
}
