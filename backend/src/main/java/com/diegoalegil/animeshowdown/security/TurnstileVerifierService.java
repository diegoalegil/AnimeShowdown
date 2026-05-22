package com.diegoalegil.animeshowdown.security;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

/**
 * Audit externo AS-004 (2026-05-23): verifica tokens Turnstile server-side
 * contra el endpoint oficial de Cloudflare.
 *
 * <p>Flujo esperado:
 * <ol>
 *   <li>Cliente renderiza el widget Turnstile cuando recibe un 428 desde
 *       el backend (signal de "fricción por abuso", lo aplica B4.2).</li>
 *   <li>Usuario completa el captcha. Cloudflare devuelve un token corto.</li>
 *   <li>Cliente reintenta el voto enviando {@code X-AS-Captcha-Token}.</li>
 *   <li>Backend (B4.2) llama a {@link #verify(String, String)} para validar
 *       contra Cloudflare. Solo si {@code success=true}, el voto procede.</li>
 * </ol>
 *
 * <p>En dev y tests, {@code app.turnstile.enabled=false} → {@link #verify}
 * devuelve true sin tocar HTTP. Eso permite los e2e/playwright actuales
 * sin necesidad de un secret real ni mockear Cloudflare.
 *
 * <p>En producción, {@code app.turnstile.enabled=true} debe ir acompañado
 * de {@code TURNSTILE_SECRET} configurado.
 * {@link com.diegoalegil.animeshowdown.config.ProductionSecretsValidator}
 * aborta el boot si esa combinación falta — fail-fast explícito antes que
 * un captcha que pasa siempre porque la verificación falla en silencio.
 */
@Service
public class TurnstileVerifierService {

    private static final Logger log = LoggerFactory.getLogger(TurnstileVerifierService.class);
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(5);

    private final boolean enabled;
    private final String secret;
    private final String endpoint;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public TurnstileVerifierService(
            @Value("${app.turnstile.enabled:false}") boolean enabled,
            @Value("${app.turnstile.secret:}") String secret,
            @Value("${app.turnstile.endpoint:https://challenges.cloudflare.com/turnstile/v0/siteverify}")
                    String endpoint,
            ObjectMapper objectMapper) {
        this.enabled = enabled;
        this.secret = secret == null ? "" : secret.trim();
        this.endpoint = endpoint;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(HTTP_TIMEOUT)
                .build();
    }

    @PostConstruct
    void logStatus() {
        if (!enabled) {
            log.info("TurnstileVerifierService DESACTIVADO (app.turnstile.enabled=false).");
            return;
        }
        if (secret.isBlank() || secret.startsWith("CHANGE_ME")) {
            // En perfil prod ProductionSecretsValidator ya habrá abortado
            // el boot. En dev con enabled=true pero sin secret, dejamos un
            // warn explícito y la verificación devolverá false siempre
            // (no permite pasar captchas con secret vacío en silencio).
            log.warn(
                    "TurnstileVerifierService activo pero TURNSTILE_SECRET vacío o placeholder."
                            + " Toda verificación fallará. Configurar el secret real.");
            return;
        }
        log.info(
                "TurnstileVerifierService inicializado: endpoint={} (secret OK, {} chars)",
                endpoint,
                secret.length());
    }

    /**
     * @return {@code true} si el token es válido o si Turnstile está desactivado.
     *         {@code false} si la verificación falla por cualquier motivo
     *         (token inválido, expirado, secret mal configurado, error de red).
     *
     * <p>Política deliberada en errores transitorios: si Cloudflare está
     * caído o el request falla por timeout, devolvemos {@code false}. Es
     * mejor pedirle al usuario que reintente el captcha que dejarlo pasar
     * gratis cuando la red falla. El log distingue causa para diagnóstico.
     */
    public boolean verify(String token, String remoteIp) {
        if (!enabled) return true;
        if (token == null || token.isBlank()) {
            log.debug("Turnstile verify: token vacío.");
            return false;
        }
        if (secret.isBlank() || secret.startsWith("CHANGE_ME")) {
            log.warn("Turnstile verify: secret no configurado; rechazando.");
            return false;
        }
        try {
            String body = formEncode(Map.of(
                    "secret", secret,
                    "response", token,
                    "remoteip", remoteIp == null ? "" : remoteIp));
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(HTTP_TIMEOUT)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                log.warn("Turnstile verify: HTTP {} desde {}", res.statusCode(), endpoint);
                return false;
            }
            JsonNode json = objectMapper.readTree(res.body());
            boolean success = json.path("success").asBoolean(false);
            if (!success) {
                log.info(
                        "Turnstile verify: success=false errorCodes={}",
                        json.path("error-codes"));
            }
            return success;
        } catch (Exception e) {
            log.warn("Turnstile verify: error de transporte: {}", e.getMessage());
            return false;
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    private static String formEncode(Map<String, String> params) {
        Map<String, String> filtered = new HashMap<>(params);
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : filtered.entrySet()) {
            if (e.getValue() == null || e.getValue().isEmpty()) continue;
            if (sb.length() > 0) sb.append('&');
            sb.append(urlEncode(e.getKey())).append('=').append(urlEncode(e.getValue()));
        }
        return sb.toString();
    }

    private static String urlEncode(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
