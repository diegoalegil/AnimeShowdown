package com.diegoalegil.animeshowdown.service;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.EloDuelChoice;
import com.diegoalegil.animeshowdown.dto.EloDuelGuessRequest;
import com.diegoalegil.animeshowdown.dto.EloDuelGuessResponse;
import com.diegoalegil.animeshowdown.dto.EloDuelRoundDto;
import com.diegoalegil.animeshowdown.dto.PersonajeScoreItem;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;

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
    // TTL corto del pool: la consulta de agregación de votos de 24h es cara y
    // se pedía sin cachear en cada /round y en cada /guess acertado (una racha
    // re-agregaba por cada paso). Mismo patrón que DueloSugeridoService.
    private static final Duration POOL_TTL = Duration.ofSeconds(30);

    private static final Logger LOG = LoggerFactory.getLogger(EloDuelService.class);

    private final PersonajeScoreQueryService personajeScoreQueryService;
    private final DropService dropService;
    private final SecureRandom secureRandom;
    private final Clock clock;
    private final SecretKeySpec tokenKey;

    private final Object poolCacheLock = new Object();
    private volatile CachedPool cachedPool;

    @Autowired
    public EloDuelService(PersonajeScoreQueryService personajeScoreQueryService, DropService dropService,
            @Value("${app.elo-duel.token-secret:}") String tokenSecret) {
        this(personajeScoreQueryService, dropService, new SecureRandom(), Clock.systemUTC(), tokenSecret);
    }

    // Conservado para tests: clave efímera derivada del SecureRandom inyectado
    // (sin secreto configurado = comportamiento histórico, determinista con un
    // SecureRandom sembrado).
    EloDuelService(PersonajeScoreQueryService personajeScoreQueryService, DropService dropService,
            SecureRandom secureRandom, Clock clock) {
        this(personajeScoreQueryService, dropService, secureRandom, clock, null);
    }

    EloDuelService(PersonajeScoreQueryService personajeScoreQueryService, DropService dropService,
            SecureRandom secureRandom, Clock clock, String tokenSecret) {
        this.personajeScoreQueryService = personajeScoreQueryService;
        this.dropService = dropService;
        this.secureRandom = secureRandom;
        this.clock = clock;
        this.tokenKey = deriveTokenKey(tokenSecret, secureRandom);
    }

    // Clave AES del token de ronda. Con app.elo-duel.token-secret configurado se
    // deriva por SHA-256 (estable entre redeploys e instancias → los tokens en
    // vuelo sobreviven). Sin secreto, clave efímera aleatoria (comportamiento
    // previo): los tokens mueren al reiniciar y no valen entre instancias.
    private static SecretKeySpec deriveTokenKey(String secret, SecureRandom rng) {
        byte[] key;
        if (secret != null && !secret.isBlank()) {
            try {
                key = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            } catch (GeneralSecurityException e) {
                throw new IllegalStateException("SHA-256 no disponible para derivar la clave del token", e);
            }
        } else {
            key = new byte[32];
            rng.nextBytes(key);
            LOG.warn("app.elo-duel.token-secret sin configurar: clave de token de ronda efímera "
                    + "(los tokens no sobreviven a un redeploy ni son válidos entre instancias)");
        }
        return new SecretKeySpec(key, "AES");
    }

    public EloDuelRoundDto iniciarRonda() {
        return crearRondaDesde(poolConSenal(), null);
    }

    public EloDuelGuessResponse resolver(EloDuelGuessRequest request, Usuario usuario) {
        RoundPayload payload = decryptToken(request.roundToken());
        EloDuelChoice correctChoice = payload.challengerElo() > payload.referenceElo()
                ? EloDuelChoice.HIGHER
                : EloDuelChoice.LOWER;
        boolean correct = request.choice() == correctChoice;
        // Recompensa server-authoritative: solo el ACIERTO de un usuario LOGUEADO
        // acredita moneda, vía DropService (tope diario + idempotencia por la ronda
        // —el roundToken cifrado es la referencia, así una ronda no paga dos veces).
        // El anónimo juega gratis sin premio. Los demás juegos client-side no pagan.
        long monedasGanadas = 0L;
        if (correct && usuario != null) {
            DropService.DropResultado resultado = dropService.otorgar(
                    usuario, MotivoMovimiento.DROP_JUEGO, referenciaRonda(request.roundToken()));
            if (resultado == DropService.DropResultado.APLICADO) {
                monedasGanadas = dropService.recompensa(MotivoMovimiento.DROP_JUEGO);
            }
        }
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
                monedasGanadas,
                nextRound);
    }

    // Referencia idempotente del drop ACOTADA: el roundToken cifrado puede pasar
    // de los 96 chars de monedero_movimiento.referencia; un SHA-256 (base64url, 43
    // chars) es estable por token → una ronda no paga dos veces, y nunca desborda.
    private String referenciaRonda(String roundToken) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256")
                    .digest(roundToken.getBytes(StandardCharsets.UTF_8));
            return "juego:elo:" + Base64.getUrlEncoder().withoutPadding().encodeToString(h);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 no disponible", e); // nunca: algoritmo estándar
        }
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

    // Cacheado con TTL corto: /round y los /guess de una racha comparten la misma
    // ventana de 24h, así que se reutiliza el pool en vez de re-agregar la consulta
    // de votos por cada llamada. Doble comprobación con lock (igual que
    // DueloSugeridoService.poolReciente). Un pool insuficiente lanza 404 sin
    // cachear, así que el caché sólo guarda pools válidos.
    private List<PersonajeScoreItem> poolConSenal() {
        Instant now = clock.instant();
        CachedPool snapshot = cachedPool;
        if (snapshot != null && now.isBefore(snapshot.expiresAt())) {
            return snapshot.items();
        }
        synchronized (poolCacheLock) {
            snapshot = cachedPool;
            if (snapshot != null && now.isBefore(snapshot.expiresAt())) {
                return snapshot.items();
            }
            List<PersonajeScoreItem> fresh = fetchPoolConSenal();
            cachedPool = new CachedPool(fresh, now.plus(POOL_TTL));
            return fresh;
        }
    }

    private List<PersonajeScoreItem> fetchPoolConSenal() {
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

    private record CachedPool(List<PersonajeScoreItem> items, Instant expiresAt) {}

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
