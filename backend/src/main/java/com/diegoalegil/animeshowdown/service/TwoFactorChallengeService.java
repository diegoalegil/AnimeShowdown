package com.diegoalegil.animeshowdown.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * Gestiona los <em>challenge tokens</em> temporales del login con 2FA
 * (Plan v2 §2.3).
 *
 * <p>Cuando el login pasa el paso 1 (username + password) pero el usuario
 * tiene 2FA activo, el backend NO emite JWT/refresh todavía. Emite un
 * challenge token de un solo uso, válido 60s, y lo devuelve al cliente.
 * El cliente luego llama <code>/2fa/verify-login</code> con el token + el
 * código TOTP. Si OK, el server emite JWT/refresh y consume el challenge.
 *
 * <p>El token se guarda en una cache in-memory Caffeine con TTL absoluto
 * de 60s y un counter de intentos por token (3 máx). Si los 3 intentos
 * fallan, el challenge se invalida — el atacante con la password debe
 * volver a hacer login para conseguir uno nuevo (rate-limitado por IP).
 *
 * <p>In-memory es suficiente para single-instance. Si en el futuro
 * Railway escala a varias instancias, hay que migrar a Redis — el TTL
 * corto hace que la migración sea simple, los usuarios solo notan
 * "código expirado, vuelve a entrar".
 */
@Service
public class TwoFactorChallengeService {

    private static final Logger log = LoggerFactory.getLogger(TwoFactorChallengeService.class);

    /** Duración del challenge. 60s coincide con la ventana TOTP × 2 — suficiente para que el user copie el código. */
    private static final Duration TTL = Duration.ofSeconds(60);

    /** Intentos máximos por challenge antes de invalidarlo. */
    private static final int MAX_INTENTOS = 3;

    private final SecureRandom random = new SecureRandom();
    private final Cache<String, Challenge> challenges = Caffeine.newBuilder()
            // expireAfterWrite porque el TTL cuenta desde la emisión, no el último acceso.
            .expireAfterWrite(TTL)
            .maximumSize(10_000)
            .build();

    /**
     * Resultado de la creación: el token a devolver al cliente y los segundos
     * que vivirá. El cliente puede usar los segundos para mostrar countdown.
     */
    public record Resultado(String token, long expiraEnSegundos) {}

    /** Crea un challenge para el usuarioId dado y lo guarda en cache. */
    public Resultado emitir(Long usuarioId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        challenges.put(token, new Challenge(usuarioId, Instant.now().plus(TTL), new AtomicInteger(0)));
        log.debug("2FA challenge emitido usuario={} ttl={}s", usuarioId, TTL.getSeconds());
        return new Resultado(token, TTL.getSeconds());
    }

    /**
     * Consume un challenge: si existe y aún no se ha invalidado, devuelve
     * el usuarioId y borra el challenge de la cache. Si los intentos ya
     * superaron el límite o el challenge no existe / expiró, devuelve empty.
     *
     * <p>El caller (AuthController) decide si validó el código TOTP y
     * llama a esto solo en éxito. Para fallos llama {@link #registrarFallo}.
     */
    public Optional<Long> consumir(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        Challenge c = challenges.getIfPresent(token);
        if (c == null) return Optional.empty();
        // El consumo es one-shot — borramos siempre.
        challenges.invalidate(token);
        return Optional.of(c.usuarioId());
    }

    /**
     * Marca un intento fallido para el token. Si supera MAX_INTENTOS,
     * invalida el challenge. Devuelve los intentos restantes (0 si ya no hay).
     */
    public int registrarFallo(String token) {
        if (token == null || token.isBlank()) return 0;
        Challenge c = challenges.getIfPresent(token);
        if (c == null) return 0;
        int intentos = c.intentos().incrementAndGet();
        int restantes = Math.max(0, MAX_INTENTOS - intentos);
        if (restantes == 0) {
            log.warn("2FA challenge invalidado por {} intentos fallidos usuario={}", MAX_INTENTOS, c.usuarioId());
            challenges.invalidate(token);
        }
        return restantes;
    }

    /** Peek sin consumir — para que el endpoint sepa si el token es válido antes de validar el código. */
    public Optional<Long> peek(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        Challenge c = challenges.getIfPresent(token);
        return Optional.ofNullable(c).map(Challenge::usuarioId);
    }

    private record Challenge(Long usuarioId, Instant expiraEn, AtomicInteger intentos) {}
}
