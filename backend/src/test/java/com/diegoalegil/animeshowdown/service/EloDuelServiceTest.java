package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.EloDuelChoice;
import com.diegoalegil.animeshowdown.dto.EloDuelGuessRequest;
import com.diegoalegil.animeshowdown.dto.EloDuelGuessResponse;
import com.diegoalegil.animeshowdown.dto.EloDuelRoundDto;
import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;

@ExtendWith(MockitoExtension.class)
class EloDuelServiceTest {

    @Mock private PersonajeScoreQueryService personajeScoreQueryService;
    @Mock private DropService dropService;

    private EloDuelService sut;
    private List<PersonajeScoreItem> pool;

    @BeforeEach
    void setUp() {
        sut = new EloDuelService(
                personajeScoreQueryService,
                dropService,
                new SecureRandom(new byte[]{1, 2, 3, 4}),
                Clock.fixed(Instant.parse("2026-05-31T12:00:00Z"), ZoneOffset.UTC));
        pool = List.of(
                item(1L, "luffy", "Luffy", "One Piece", 1880, 42.0, 3.0),
                item(2L, "zoro", "Zoro", "One Piece", 1840, 31.0, 1.0),
                item(3L, "nami", "Nami", "One Piece", 1760, 12.0, 0.0),
                item(4L, "sakura", "Sakura", "Naruto", 1650, 4.0, 0.0));
    }

    @Test
    void iniciarRondaOcultaEloDelChallengerYEntregaTokenCifrado() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);

        EloDuelRoundDto round = sut.iniciarRonda();

        assertNotNull(round.roundToken());
        assertTrue(round.roundToken().startsWith("v1."));
        assertNotNull(round.reference());
        assertNotNull(round.challenger());
        // El color dominante debe propagarse al mini-DTO para que la carta del
        // ELO duel pinte el fondo real y no caiga al gris var(--color-surface).
        assertEquals(colorBySlug(round.reference().getSlug()), round.reference().getImagenColorDominante());
        assertEquals(colorBySlug(round.challenger().getSlug()), round.challenger().getImagenColorDominante());
        assertTrue(round.referenceElo() >= 1500);
        assertEquals("ELO competitivo", round.scoreLabel());
        assertFalse(Arrays.stream(EloDuelRoundDto.class.getRecordComponents())
                .anyMatch(component -> component.getName().equals("challengerElo")));
    }

    @Test
    void resolverValidaLaRespuestaEnServidorYDevuelveSiguienteRondaSiAcierta() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);

        EloDuelRoundDto round = sut.iniciarRonda();
        EloDuelChoice correctChoice = expectedChoice(round);

        EloDuelGuessResponse result =
                sut.resolver(new EloDuelGuessRequest(round.roundToken(), correctChoice), null);

        assertTrue(result.correct());
        assertEquals(correctChoice, result.correctChoice());
        assertTrue(result.challengerElo() >= 1500);
        assertTrue(result.eloDiff() > 0);
        assertNotNull(result.nextRound());
        // El pool se cachea (TTL corto); ya no se re-agrega por ronda. La consulta
        // se ejecuta al menos una vez para abrir la primera ronda.
        verify(personajeScoreQueryService, atLeastOnce()).topConPuntuacionYRecencia(any(), anyInt());
    }

    @Test
    void poolSeCacheaEntreRondasDentroDelTtl() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);

        // Reloj fijo (mismo instante < TTL): iniciarRonda + el siguiente round del
        // acierto comparten el pool cacheado, así que la consulta cara de
        // agregación se ejecuta UNA sola vez en vez de una por ronda.
        EloDuelRoundDto round = sut.iniciarRonda();
        sut.resolver(new EloDuelGuessRequest(round.roundToken(), expectedChoice(round)), null);

        verify(personajeScoreQueryService, times(1)).topConPuntuacionYRecencia(any(), anyInt());
    }

    @Test
    void resolverRechazaTokenManipulado() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);

        EloDuelRoundDto round = sut.iniciarRonda();
        String tampered = tamperCiphertext(round.roundToken());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> sut.resolver(new EloDuelGuessRequest(tampered, EloDuelChoice.HIGHER), null));

        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void conTokenSecretLaClaveEsEstableEntreInstancias() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);
        // Dos instancias (dos réplicas o un redeploy) con el MISMO secreto
        // derivan la misma clave AES → el token emitido por una se resuelve en
        // la otra.
        EloDuelService emisor = conSecreto("secreto-compartido");
        EloDuelService receptor = conSecreto("secreto-compartido");

        EloDuelRoundDto round = emisor.iniciarRonda();
        EloDuelGuessResponse result = receptor.resolver(
                new EloDuelGuessRequest(round.roundToken(), expectedChoice(round)), null);

        assertTrue(result.correct());
    }

    @Test
    void sinTokenSecretLaClaveEsEfimeraYNoValeEntreInstancias() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);
        // Sin secreto cada instancia genera una clave aleatoria distinta → el
        // token de una NO se descifra en otra (el fallo previo que corrige el
        // secreto configurable).
        EloDuelService emisor = sinSecreto();
        EloDuelService receptor = sinSecreto();

        EloDuelRoundDto round = emisor.iniciarRonda();
        EloDuelGuessRequest request =
                new EloDuelGuessRequest(round.roundToken(), expectedChoice(round));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> receptor.resolver(request, null));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void aciertoDeUsuarioLogueadoAcreditaMonedaConReferenciaDeRonda() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);
        when(dropService.otorgar(any(), eq(MotivoMovimiento.DROP_JUEGO), anyString()))
                .thenReturn(DropService.DropResultado.APLICADO);
        when(dropService.recompensa(MotivoMovimiento.DROP_JUEGO)).thenReturn(3L);
        Usuario usuario = mock(Usuario.class);

        EloDuelRoundDto round = sut.iniciarRonda();
        EloDuelChoice correctChoice = expectedChoice(round);

        EloDuelGuessResponse result =
                sut.resolver(new EloDuelGuessRequest(round.roundToken(), correctChoice), usuario);

        assertTrue(result.correct());
        assertEquals(3L, result.monedasGanadas());
        // Idempotencia: la referencia es un hash acotado del roundToken (1:1 con
        // la ronda, <=96 chars de la columna) → una ronda no paga dos veces ni desborda.
        verify(dropService).otorgar(eq(usuario), eq(MotivoMovimiento.DROP_JUEGO),
                argThat(ref -> ref.startsWith("juego:elo:") && ref.length() <= 96));
    }

    @Test
    void anonimoAciertaPeroNoAcreditaMoneda() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);

        EloDuelRoundDto round = sut.iniciarRonda();
        EloDuelChoice correctChoice = expectedChoice(round);

        EloDuelGuessResponse result =
                sut.resolver(new EloDuelGuessRequest(round.roundToken(), correctChoice), null);

        assertTrue(result.correct());
        assertEquals(0L, result.monedasGanadas());
        verifyNoInteractions(dropService);
    }

    @Test
    void fallarNoAcreditaMonedaAunqueEstesLogueado() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);
        Usuario usuario = mock(Usuario.class);

        EloDuelRoundDto round = sut.iniciarRonda();
        EloDuelChoice wrong = opposite(expectedChoice(round));

        EloDuelGuessResponse result =
                sut.resolver(new EloDuelGuessRequest(round.roundToken(), wrong), usuario);

        assertFalse(result.correct());
        assertEquals(0L, result.monedasGanadas());
        verify(dropService, never()).otorgar(any(), any(), anyString());
    }

    @Test
    void aciertoTopadoOIdempotenteDevuelveCeroMonedas() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(pool);
        when(dropService.otorgar(any(), eq(MotivoMovimiento.DROP_JUEGO), anyString()))
                .thenReturn(DropService.DropResultado.TOPE_DIARIO);
        Usuario usuario = mock(Usuario.class);

        EloDuelRoundDto round = sut.iniciarRonda();
        EloDuelChoice correctChoice = expectedChoice(round);

        EloDuelGuessResponse result =
                sut.resolver(new EloDuelGuessRequest(round.roundToken(), correctChoice), usuario);

        assertTrue(result.correct());
        assertEquals(0L, result.monedasGanadas());
    }

    @Test
    void iniciarRondaRechazaPoolSinPuntuacionDistinta() {
        when(personajeScoreQueryService.topConPuntuacionYRecencia(any(), anyInt())).thenReturn(List.of(
                item(1L, "a", "A", "Anime", 1500, 0.0, 0.0),
                item(2L, "b", "B", "Anime", 1500, 0.0, 0.0)));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> sut.iniciarRonda());

        assertEquals(404, ex.getStatusCode().value());
    }

    private static EloDuelChoice opposite(EloDuelChoice c) {
        return c == EloDuelChoice.HIGHER ? EloDuelChoice.LOWER : EloDuelChoice.HIGHER;
    }

    private EloDuelService conSecreto(String secret) {
        return new EloDuelService(personajeScoreQueryService, dropService, new SecureRandom(),
                Clock.fixed(Instant.parse("2026-05-31T12:00:00Z"), ZoneOffset.UTC), secret);
    }

    private EloDuelService sinSecreto() {
        return new EloDuelService(personajeScoreQueryService, dropService, new SecureRandom(),
                Clock.fixed(Instant.parse("2026-05-31T12:00:00Z"), ZoneOffset.UTC), null);
    }

    private EloDuelChoice expectedChoice(EloDuelRoundDto round) {
        int referenceElo = eloBySlug(round.reference().getSlug());
        int challengerElo = eloBySlug(round.challenger().getSlug());
        assertEquals(referenceElo, round.referenceElo());
        assertNotEquals(referenceElo, challengerElo);
        return challengerElo > referenceElo ? EloDuelChoice.HIGHER : EloDuelChoice.LOWER;
    }

    private int eloBySlug(String slug) {
        return pool.stream()
                .filter(item -> item.slug().equals(slug))
                .findFirst()
                .map(PersonajeScoreItem::eloEstimado)
                .orElseThrow();
    }

    private static String tamperCiphertext(String token) {
        String[] parts = token.split("\\.");
        assertEquals(3, parts.length);
        char first = parts[2].charAt(0);
        parts[2] = (first == 'A' ? 'B' : 'A') + parts[2].substring(1);
        return String.join(".", parts);
    }

    private static PersonajeScoreItem item(Long id, String slug, String nombre, String anime,
            Integer eloSemilla, Double votosTotales, Double votosRecientes24h) {
        return new PersonajeScoreItem(id, slug, nombre, anime, "/img/" + slug + ".webp",
                "#%06x".formatted((id * 0x112233L) & 0xFFFFFFL),
                eloSemilla,
                votosTotales, votosRecientes24h);
    }

    private String colorBySlug(String slug) {
        return pool.stream()
                .filter(item -> item.slug().equals(slug))
                .findFirst()
                .map(PersonajeScoreItem::imagenColorDominante)
                .orElseThrow();
    }
}
