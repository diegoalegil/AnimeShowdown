package com.diegoalegil.animeshowdown.security;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/**
 * Audit externo AS-004 (2026-05-23): identidad anónima server-side.
 *
 * <p>Antes el voto invitado se ataba a un identifier en localStorage +
 * header {@code X-AS-Anonymous-Id} controlable desde el cliente. Borrar
 * el storage o rotar el header reseteaba el cupo de 5 votos invitados.
 * Para mitigar el abuso:
 *
 * <ol>
 *   <li>El server emite un token aleatorio de 16 bytes (UUID-equivalente,
 *       128 bits de entropía) cuando un cliente sin cookie hace su primer
 *       voto invitado.</li>
 *   <li>El token se firma con HMAC-SHA256 contra una clave secreta del
 *       server. Formato: {@code <random_b64url>.<hmac_b64url>}.</li>
 *   <li>Se devuelve en cookie httpOnly + Secure + SameSite=Lax con TTL de
 *       30 días. El JS del cliente no puede leerla ni reemplazarla. Solo el
 *       browser la envía automáticamente con cada request.</li>
 *   <li>Borrar la cookie desde DevTools rota la identidad — fricción muy
 *       superior a borrar localStorage. Cambiar el HMAC en el server
 *       invalida todas las cookies emitidas previamente.</li>
 * </ol>
 *
 * <p>NOTA: este servicio solo emite y verifica tokens. El enforcement de
 * límites (10/h, 30/h, 100/24h) y el bind a IP+UA hash quedan en
 * componentes separados (B4.2) para mantener responsabilidades simples.
 *
 * <p>El captcha Turnstile bajo abuso se aplica como segunda barrera —
 * la cookie es la identidad estable, el captcha es la fricción solo
 * cuando la actividad anónima cruza umbrales sospechosos.
 */
@Service
public class AnonymousIdentityService {

    private static final Logger log = LoggerFactory.getLogger(AnonymousIdentityService.class);
    private static final String HMAC_ALGO = "HmacSHA256";
    private static final int RANDOM_BYTES = 16;
    /** Separador entre random y HMAC en el token serializado. Char no-b64url. */
    private static final char TOKEN_SEPARATOR = '.';

    private final SecureRandom secureRandom = new SecureRandom();
    private final byte[] hmacKey;
    private final String cookieName;
    private final Duration cookieTtl;

    public AnonymousIdentityService(
            @Value("${app.anon-identity.hmac-key}") String hmacKeyStr,
            @Value("${app.anon-identity.cookie-name:as_anon}") String cookieName,
            @Value("${app.anon-identity.cookie-ttl-days:30}") int cookieTtlDays) {
        if (hmacKeyStr == null || hmacKeyStr.isBlank()) {
            throw new IllegalStateException(
                    "app.anon-identity.hmac-key vacía. ProductionSecretsValidator debería"
                            + " haber abortado el boot antes de llegar aquí.");
        }
        // Aceptamos string UTF-8 cualquiera (incluido base64). Recomendamos
        // 32+ bytes para HMAC-SHA256; advertimos si es más corto.
        this.hmacKey = hmacKeyStr.getBytes(StandardCharsets.UTF_8);
        if (hmacKey.length < 32) {
            log.warn(
                    "app.anon-identity.hmac-key tiene solo {} bytes; recomendado 32+ para HMAC-SHA256.",
                    hmacKey.length);
        }
        this.cookieName = cookieName;
        this.cookieTtl = Duration.ofDays(Math.max(1, cookieTtlDays));
    }

    /**
     * Emite un nuevo token anónimo firmado. Devuelve la cadena serializada
     * lista para meter en cookie. NO escribe la cookie en la respuesta —
     * eso lo hace el caller con {@link #buildCookie(String)} o leyendo
     * {@link #getCookieName()}.
     */
    public String emit() {
        byte[] random = new byte[RANDOM_BYTES];
        secureRandom.nextBytes(random);
        String randomB64 = base64Url(random);
        String hmac = computeHmac(randomB64);
        return randomB64 + TOKEN_SEPARATOR + hmac;
    }

    /**
     * Verifica un token serializado y devuelve el componente "random"
     * (identidad anónima estable) si la firma es válida. {@code Optional.empty()}
     * si el token está malformado, expirado a nivel de firma (HMAC inválido),
     * o si su shape no encaja.
     *
     * <p>El TTL de 30 días lo aplica el navegador via cookie Max-Age — el
     * server no tiene timestamp dentro del token. Tradeoff: tokens más
     * cortos, sin reloj distribuido, pero un token filtrado sigue siendo
     * válido hasta que se rote la clave HMAC.
     */
    public Optional<String> verify(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        int sep = token.indexOf(TOKEN_SEPARATOR);
        if (sep <= 0 || sep == token.length() - 1) return Optional.empty();
        String randomB64 = token.substring(0, sep);
        String hmacB64 = token.substring(sep + 1);
        String expected = computeHmac(randomB64);
        // Constant-time compare para evitar timing attacks comparando HMACs.
        if (!constantTimeEquals(expected, hmacB64)) return Optional.empty();
        return Optional.of(randomB64);
    }

    /**
     * Construye la cookie con flags de seguridad. httpOnly + Secure +
     * SameSite=Lax son obligatorios — el cliente no debería poder leerla.
     */
    public ResponseCookie buildCookie(String token) {
        return ResponseCookie.from(cookieName, token)
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(cookieTtl)
                .build();
    }

    public String getCookieName() {
        return cookieName;
    }

    public Duration getCookieTtl() {
        return cookieTtl;
    }

    private String computeHmac(String message) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            mac.init(new SecretKeySpec(hmacKey, HMAC_ALGO));
            byte[] sig = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return base64Url(sig);
        } catch (Exception e) {
            // HMAC-SHA256 está siempre disponible en la JDK; este branch
            // solo se dispara si el key spec es inválido (longitud 0, etc.).
            throw new IllegalStateException("No se pudo calcular HMAC", e);
        }
    }

    private static String base64Url(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    /**
     * Comparación de igualdad en tiempo constante para evitar leak por
     * timing del HMAC. Mismo patrón que {@code MessageDigest.isEqual}.
     */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
        }
        return result == 0;
    }
}
