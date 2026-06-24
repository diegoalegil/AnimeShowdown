package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.dto.CartaCatalogoItem;
import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCartaPity;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;
import com.diegoalegil.animeshowdown.repository.SobreAperturaRepository;
import com.diegoalegil.animeshowdown.repository.SobreGratisCreditoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaPityRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

import jakarta.persistence.EntityManager;

@ExtendWith(MockitoExtension.class)
class CartaServiceTest {

    @Mock private UsuarioCartaRepository usuarioCartaRepository;
    @Mock private UsuarioCartaPityRepository pityRepository;
    @Mock private SobreAperturaRepository sobreAperturaRepository;
    @Mock private MonederoMovimientoRepository movimientoRepository;
    @Mock private UsuarioRepository usuarioRepository;
    @Mock private CartaRepository cartaRepository;
    @Mock private SobreGratisCreditoRepository sobreGratisCreditoRepository;
    @Mock private MonederoService monederoService;
    @Mock private RarezaService rarezaService;
    @Mock private AuditLogService auditLogService;
    @Mock private CartaLecturaCacheService cartaLecturaCacheService;
    @Mock private EntityManager entityManager;

    private CartaService sut;

    @BeforeEach
    void setUp() {
        sut = new CartaService(
                usuarioCartaRepository,
                pityRepository,
                sobreAperturaRepository,
                movimientoRepository,
                usuarioRepository,
                cartaRepository,
                sobreGratisCreditoRepository,
                monederoService,
                rarezaService,
                auditLogService,
                cartaLecturaCacheService,
                entityManager,
                Clock.fixed(Instant.parse("2026-06-02T12:00:00Z"), ZoneOffset.UTC),
                10L,
                50L);
    }

    @Test
    void coleccionAceptaScoresDecimalesPorEmpateNeutral() {
        Usuario usuario = new Usuario("cartas_decimal", "hash", "cartas_decimal@example.com");
        usuario.setId(1L);

        when(cartaLecturaCacheService.catalogo()).thenReturn(List.of(new CartaCatalogoItem(
                100L, 10L, "goku", "Goku", "Dragon Ball", "/img/goku.webp",
                null, RarezaCarta.SSR, false, "", null)));
        when(usuarioCartaRepository.findPosesionesByUsuario(usuario))
                .thenReturn(List.of(new UsuarioCartaPosesionItem(100L, 1)));
        when(cartaLecturaCacheService.votosPorPersonaje()).thenReturn(Map.of(10L, 1L));
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
    void abrirSobreSinIdempotencyKeyRechazaAntesDeTocarEconomia() {
        Usuario usuario = new Usuario("cartas_sin_key", "hash", "cartas_sin_key@example.com");
        usuario.setId(9L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> sut.abrirSobre(usuario, " "));

        assertEquals("X-Idempotency-Key es obligatorio para abrir sobres", ex.getMessage());
        verifyNoInteractions(sobreAperturaRepository, pityRepository, monederoService);
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
        // INSERT atómico de la posesión: 1 = insertada (carta nueva). El mock no
        // modela "ya existe", así que cada carta del pack se registra como nueva.
        when(usuarioCartaRepository.insertarPosesionSiFalta(
                org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(1);
        when(cartaLecturaCacheService.votosPorPersonaje()).thenReturn(Map.of());
        when(sobreAperturaRepository.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        sut.abrirSobre(usuario, "idem-race");

        var order = inOrder(pityRepository, usuarioRepository);
        order.verify(pityRepository).findForUpdateByUsuarioId(usuario.getId());
        order.verify(usuarioRepository).findForUpdateById(usuario.getId());
        order.verify(pityRepository).findForUpdateByUsuarioId(usuario.getId());
        order.verify(pityRepository).saveAndFlush(org.mockito.ArgumentMatchers.any(UsuarioCartaPity.class));
    }

    @Test
    void sobreBienvenidaGarantizaEspecialYGratisYMarcaUsuario() {
        Usuario usuario = new Usuario("nuevo", "hash", "nuevo@example.com");
        usuario.setId(5L);
        Personaje personaje = new Personaje("naruto", "Naruto", "Naruto", "desc", "/img/naruto.webp");
        personaje.setId(50L);
        Carta normal = carta(personaje, 1L, RarezaCarta.SSR);
        Carta especial = carta(personaje, 2L, RarezaCarta.ESPECIAL);

        when(sobreAperturaRepository.findByUsuarioAndIdempotencyKey(usuario, "bienvenida:5"))
                .thenReturn(Optional.empty());
        when(rarezaService.elegirSobre(true))
                .thenReturn(new RarezaService.SobreDraw(
                        List.of(normal, normal, normal, normal), especial, true));
        when(monederoService.saldoDe(usuario)).thenReturn(0L);
        when(usuarioCartaRepository.findByUsuarioAndCarta(eq(usuario), org.mockito.ArgumentMatchers.any(Carta.class)))
                .thenReturn(Optional.empty());
        // INSERT atómico de la posesión: 1 = insertada (carta nueva).
        when(usuarioCartaRepository.insertarPosesionSiFalta(
                org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(1);
        when(sobreAperturaRepository.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        sut.reclamarSobreBienvenida(usuario);

        // No debita moneda; pide un sobre con especial garantizada; marca al usuario.
        verifyNoInteractions(pityRepository);
        org.mockito.Mockito.verify(monederoService, org.mockito.Mockito.never())
                .debitar(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        anyString(), org.mockito.ArgumentMatchers.anyLong());
        org.mockito.Mockito.verify(usuarioRepository).save(usuario);
        assertEquals(java.time.LocalDateTime.now(
                        Clock.fixed(Instant.parse("2026-06-02T12:00:00Z"), ZoneOffset.UTC)),
                usuario.getSobreBienvenidaReclamadoEn());
    }

    @Test
    void sobreBienvenidaEsIdempotentePorAperturaExistente() {
        Usuario usuario = new Usuario("repetido", "hash", "repetido@example.com");
        usuario.setId(8L);
        com.diegoalegil.animeshowdown.model.SobreApertura previa =
                new com.diegoalegil.animeshowdown.model.SobreApertura(usuario, "bienvenida:8");

        // El servicio re-lee al usuario CON LOCK para serializar dobles
        // clicks; esa lectura es la única interacción esperada con el repo.
        when(usuarioRepository.findForUpdateById(8L)).thenReturn(Optional.of(usuario));
        when(sobreAperturaRepository.findByUsuarioAndIdempotencyKey(usuario, "bienvenida:8"))
                .thenReturn(Optional.of(previa));

        sut.reclamarSobreBienvenida(usuario);

        // Devuelve la apertura ya hecha sin volver a sortear ni marcar nada.
        verifyNoInteractions(rarezaService);
        org.mockito.Mockito.verify(usuarioRepository).findForUpdateById(8L);
        org.mockito.Mockito.verifyNoMoreInteractions(usuarioRepository);
    }

    @Test
    void concederCartaEspecialEncuentraLaEspecialAunqueTengaVarianteNoVacia() {
        Usuario usuario = new Usuario("fan", "hash", "fan@example.com");
        usuario.setId(9L);
        Personaje personaje = new Personaje("naruto", "Naruto", "Naruto", "desc", "/img/naruto.webp");
        personaje.setId(50L);
        Carta especialVariante = carta(personaje, 7L, RarezaCarta.ESPECIAL);

        // La ESPECIAL de este personaje tiene variante no vacía: el finder antiguo
        // (variante="") devolvía null; el variante-agnóstico la encuentra.
        when(cartaRepository.findFirstByPersonajeSlugAndRarezaOrderByVarianteAsc("naruto", RarezaCarta.ESPECIAL))
                .thenReturn(Optional.of(especialVariante));
        when(usuarioCartaRepository.insertarPosesionSiFalta(
                org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(1);

        Carta concedida = sut.concederCartaEspecialPorSlug(usuario, "naruto");

        assertEquals(especialVariante, concedida);
    }

    private static Carta carta(Personaje personaje, Long id, RarezaCarta rareza) {
        Carta carta = new Carta(personaje, rareza);
        carta.setId(id);
        return carta;
    }
}
