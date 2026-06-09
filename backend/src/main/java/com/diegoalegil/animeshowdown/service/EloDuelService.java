package com.diegoalegil.animeshowdown.service;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.EloDuelChoice;
import com.diegoalegil.animeshowdown.dto.EloDuelGuessRequest;
import com.diegoalegil.animeshowdown.dto.EloDuelGuessResponse;
import com.diegoalegil.animeshowdown.dto.EloDuelRoundDto;
import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;

@Service
public class EloDuelService {

    private static final int TOP_POOL = 200;
    private static final int MAX_ATTEMPTS = 200;
    private static final int MIN_ELO_DELTA = 5;
    private static final int MAX_ELO_DELTA = 180;
    private static final long TOKEN_TTL_SECONDS = 10 * 60;
    private static final String TOKEN_VERSION = "v1";
    private static final String SCORE_LABEL = "ELO competitivo";
    private static final String ALGORITHM = "server_vote_score_balanced";

    private final PersonajeScoreQueryService personajeScoreQueryService;
    private final SecureRandom secureRandom;
    private final Clock clock;
    private final SecretKeySpec tokenKey;

    @Autowired
    public EloDuelService(PersonajeScoreQueryService personajeScoreQueryService) {
        this(personajeScoreQueryService, new SecureRandom(), Clock.systemUTC());
    }

    EloDuelService(PersonajeScoreQueryService personajeScoreQueryService, SecureRandom secureRandom, Clock clock) {
        this.personajeScoreQueryService = personajeScoreQueryService;
        this.secureRandom = secureRandom;
        this.clock = clock;
        byte[] key = new byte[32];
        this.secureRandom.nextBytes(key);
        this.tokenKey = new SecretKeySpec(key, "AES");
    }

    public EloDuelRoundDto iniciarRonda() {
        return crearRondaDesde(poolConSenal(), null);
    }

    public EloDuelGuessResponse resolver(EloDuelGuessRequest request) {
        RoundPayload payload = decryptToken(request.roundToken());
        EloDuelChoice correctChoice = payload.challengerElo() > payload.referenceElo()
                ? EloDuelChoice.HIGHER
                : EloDuelChoice.LOWER;
        boolean correct = request.choice() == correctChoice;
        EloDuelRoundDto nextRound = correct
                ? crearSiguienteRonda(payload.challengerId())
                : null;
        return new EloDuelGuessResponse(
                correct,
                request.choice(),
                correctChoice,
                payload.referenceElo(),
                payload.challengerElo(),
                Math.abs(payload.challengerElo() - payload.referenceElo()),
                nextRound);
    }

    private EloDuelRoundDto crearSiguienteRonda(Long referenceId) {
        List<PersonajeScoreItem> pool = poolConSenal();
        PersonajeScoreItem reference = pool.stream()
                .filter(p -> p.id().equals(referenceId))
                .findFirst()
                .orElse(null);
        if (reference == null) {
            return crearRondaDesde(pool, null);
        }
        return crearRondaDesde(pool, reference);
    }

    private EloDuelRoundDto crearRondaDesde(List<PersonajeScoreItem> pool, PersonajeScoreItem preferredReference) {
        if (preferredReference != null) {
            PersonajeScoreItem challenger = elegirRivalBalanceado(pool, preferredReference);
            if (challenger != null) {
                return construirRonda(preferredReference, challenger);
            }
        }

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            PersonajeScoreItem reference = randomItem(pool);
            PersonajeScoreItem challenger = elegirRivalBalanceado(pool, reference);
            if (challenger != null) {
                return construirRonda(reference, challenger);
            }
        }

        List<PersonajeScoreItem> ordenados = new ArrayList<>(pool);
        ordenados.sort(Comparator.comparingInt(this::eloCompetitivo).reversed());
        for (int i = 0; i < ordenados.size(); i++) {
            PersonajeScoreItem reference = ordenados.get(i);
            PersonajeScoreItem challenger = elegirRivalConSenalMinima(ordenados, reference);
            if (challenger != null) {
                return construirRonda(reference, challenger);
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "ELO Duel necesita al menos dos personajes con puntuacion distinta");
    }

    private List<PersonajeScoreItem> poolConSenal() {
        List<PersonajeScoreItem> pool = personajeScoreQueryService.topConPuntuacionYRecencia(
                LocalDateTime.now(clock).minusHours(24),
                TOP_POOL);
        List<PersonajeScoreItem> elegibles = pool.stream()
                .filter(p -> p.id() != null)
                .toList();
        long ratingsDistintos = elegibles.stream()
                .map(this::eloCompetitivo)
                .distinct()
                .limit(2)
                .count();
        if (elegibles.size() < 2 || ratingsDistintos < 2) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "ELO Duel necesita votos comunitarios suficientes para abrir una ronda justa");
        }
        return elegibles;
    }

    private PersonajeScoreItem elegirRivalBalanceado(List<PersonajeScoreItem> pool, PersonajeScoreItem reference) {
        int referenceElo = eloCompetitivo(reference);
        List<PersonajeScoreItem> balanceados = pool.stream()
                .filter(p -> !p.id().equals(reference.id()))
                .filter(p -> {
                    int delta = Math.abs(eloCompetitivo(p) - referenceElo);
                    return delta >= MIN_ELO_DELTA && delta <= MAX_ELO_DELTA;
                })
                .toList();
        if (!balanceados.isEmpty()) {
            return randomItem(balanceados);
        }
        return elegirRivalConSenalMinima(pool, reference);
    }

    private PersonajeScoreItem elegirRivalConSenalMinima(List<PersonajeScoreItem> pool, PersonajeScoreItem reference) {
        int referenceElo = eloCompetitivo(reference);
        return pool.stream()
                .filter(p -> !p.id().equals(reference.id()))
                .filter(p -> eloCompetitivo(p) != referenceElo)
                .min(Comparator.comparingInt(p -> Math.abs(eloCompetitivo(p) - referenceElo)))
                .orElse(null);
    }

    private EloDuelRoundDto construirRonda(PersonajeScoreItem reference, PersonajeScoreItem challenger) {
        int referenceElo = eloCompetitivo(reference);
        int challengerElo = eloCompetitivo(challenger);
        Instant expiresAt = Instant.now(clock).plusSeconds(TOKEN_TTL_SECONDS);
        RoundPayload payload = new RoundPayload(reference.id(), challenger.id(), referenceElo, challengerElo,
                expiresAt.getEpochSecond());
        return new EloDuelRoundDto(
                encryptToken(payload),
                reference.toMiniDto(),
                challenger.toMiniDto(),
                referenceElo,
                SCORE_LABEL,
                ALGORITHM,
                expiresAt);
    }

    private int eloCompetitivo(PersonajeScoreItem item) {
        return item.eloEstimado();
    }

    private PersonajeScoreItem randomItem(List<PersonajeScoreItem> items) {
        return items.get(secureRandom.nextInt(items.size()));
    }

    private String encryptToken(RoundPayload payload) {
        try {
            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, tokenKey, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(payload.serialize().getBytes(StandardCharsets.UTF_8));
            Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
            return TOKEN_VERSION + "." + encoder.encodeToString(iv) + "." + encoder.encodeToString(encrypted);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("No se pudo firmar la ronda ELO Duel", ex);
        }
    }

    private RoundPayload decryptToken(String token) {
        try {
            String[] parts = token == null ? new String[0] : token.split("\\.");
            if (parts.length != 3 || !TOKEN_VERSION.equals(parts[0])) {
                throw new IllegalArgumentException("Formato de token invalido");
            }
            Base64.Decoder decoder = Base64.getUrlDecoder();
            byte[] iv = decoder.decode(parts[1]);
            byte[] encrypted = decoder.decode(parts[2]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, tokenKey, new GCMParameterSpec(128, iv));
            String serialized = new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            RoundPayload payload = RoundPayload.deserialize(serialized);
            if (payload.expiresAtEpoch() < Instant.now(clock).getEpochSecond()) {
                throw new ResponseStatusException(HttpStatus.GONE, "La ronda ha expirado");
            }
            return payload;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (GeneralSecurityException | IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token de ronda invalido");
        }
    }

    private record RoundPayload(
            Long referenceId,
            Long challengerId,
            int referenceElo,
            int challengerElo,
            long expiresAtEpoch) {

        String serialize() {
            return referenceId + "|" + challengerId + "|" + referenceElo + "|" + challengerElo + "|" + expiresAtEpoch;
        }

        static RoundPayload deserialize(String value) {
            String[] parts = value.split("\\|");
            if (parts.length != 5) {
                throw new IllegalArgumentException("Payload invalido");
            }
            return new RoundPayload(
                    Long.parseLong(parts[0]),
                    Long.parseLong(parts[1]),
                    Integer.parseInt(parts[2]),
                    Integer.parseInt(parts[3]),
                    Long.parseLong(parts[4]));
        }
    }
}
