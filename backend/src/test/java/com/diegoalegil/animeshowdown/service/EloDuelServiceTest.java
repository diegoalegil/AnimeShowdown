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
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@ExtendWith(MockitoExtension.class)
class EloDuelServiceTest {

    @Mock private PersonajeRepository personajeRepository;

    private EloDuelService sut;
    private List<PersonajeScoreItem> pool;

    @BeforeEach
    void setUp() {
        sut = new EloDuelService(
                personajeRepository,
                new SecureRandom(new byte[]{1, 2, 3, 4}),
                Clock.fixed(Instant.parse("2026-05-31T12:00:00Z"), ZoneOffset.UTC));
        pool = List.of(
                item(1L, "luffy", "Luffy", "One Piece", 42.0, 3.0),
                item(2L, "zoro", "Zoro", "One Piece", 31.0, 1.0),
                item(3L, "nami", "Nami", "One Piece", 12.0, 0.0),
                item(4L, "sakura", "Sakura", "Naruto", 4.0, 0.0));
    }

    @Test
    void iniciarRondaOcultaEloDelChallengerYEntregaTokenCifrado() {
        when(personajeRepository.topConPuntuacionYRecencia(any(), any())).thenReturn(pool);

        EloDuelRoundDto round = sut.iniciarRonda();

        assertNotNull(round.roundToken());
        assertTrue(round.roundToken().startsWith("v1."));
        assertNotNull(round.reference());
        assertNotNull(round.challenger());
        assertTrue(round.referenceElo() >= 1500);
        assertEquals("ELO competitivo", round.scoreLabel());
        assertFalse(Arrays.stream(EloDuelRoundDto.class.getRecordComponents())
                .anyMatch(component -> component.getName().equals("challengerElo")));
    }

    @Test
    void resolverValidaLaRespuestaEnServidorYDevuelveSiguienteRondaSiAcierta() {
        when(personajeRepository.topConPuntuacionYRecencia(any(), any())).thenReturn(pool);

        EloDuelRoundDto round = sut.iniciarRonda();
        EloDuelChoice correctChoice = expectedChoice(round);

        EloDuelGuessResponse result = sut.resolver(new EloDuelGuessRequest(round.roundToken(), correctChoice));

        assertTrue(result.correct());
        assertEquals(correctChoice, result.correctChoice());
        assertTrue(result.challengerElo() >= 1500);
        assertTrue(result.eloDiff() > 0);
        assertNotNull(result.nextRound());
        verify(personajeRepository, atLeast(2)).topConPuntuacionYRecencia(any(), any());
    }

    @Test
    void resolverRechazaTokenManipulado() {
        when(personajeRepository.topConPuntuacionYRecencia(any(), any())).thenReturn(pool);

        EloDuelRoundDto round = sut.iniciarRonda();
        String tampered = tamperCiphertext(round.roundToken());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> sut.resolver(new EloDuelGuessRequest(tampered, EloDuelChoice.HIGHER)));

        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void iniciarRondaRechazaPoolSinPuntuacionDistinta() {
        when(personajeRepository.topConPuntuacionYRecencia(any(), any())).thenReturn(List.of(
                item(1L, "a", "A", "Anime", 0.0, 0.0),
                item(2L, "b", "B", "Anime", 0.0, 0.0)));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> sut.iniciarRonda());

        assertEquals(404, ex.getStatusCode().value());
    }

    private EloDuelChoice expectedChoice(EloDuelRoundDto round) {
        double referenceScore = scoreBySlug(round.reference().getSlug());
        double challengerScore = scoreBySlug(round.challenger().getSlug());
        int referenceElo = 1500 + (int) Math.round(referenceScore * 10.0);
        int challengerElo = 1500 + (int) Math.round(challengerScore * 10.0);
        assertEquals(referenceElo, round.referenceElo());
        assertNotEquals(referenceElo, challengerElo);
        return challengerElo > referenceElo ? EloDuelChoice.HIGHER : EloDuelChoice.LOWER;
    }

    private double scoreBySlug(String slug) {
        return pool.stream()
                .filter(item -> item.slug().equals(slug))
                .findFirst()
                .map(PersonajeScoreItem::votosTotales)
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
            Double votosTotales, Double votosRecientes24h) {
        return new PersonajeScoreItem(id, slug, nombre, anime, "/img/" + slug + ".webp",
                votosTotales, votosRecientes24h);
    }
}
