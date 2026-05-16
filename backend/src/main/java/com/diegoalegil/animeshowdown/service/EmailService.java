package com.diegoalegil.animeshowdown.service;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.diegoalegil.animeshowdown.model.EmailFailure;
import com.diegoalegil.animeshowdown.model.EmailTipo;
import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;

/**
 * Envío de emails transaccionales vía Resend (HTTPS, sin SMTP).
 *
 * Plan v2 §2.12 — async queue robusta:
 *
 *   - Pool dedicado emailExecutor (AsyncConfig): 2-5 hilos, queue 100,
 *     CallerRunsPolicy en saturación. Antes SimpleAsyncTaskExecutor
 *     creaba hilos sin límite si Resend respondía lento.
 *
 *   - @Retryable 3 intentos con backoff exponencial 1s/2s/4s. Cubre los
 *     blips típicos (network glitch, Resend 502 puntual).
 *
 *   - @Recover persiste el fallo en email_failed_queue con error_msg
 *     truncado. El admin puede listar fallos vía endpoint y reintentar
 *     manualmente cuando Resend esté sano.
 *
 *   - Si la API key está vacía (dev sin Resend), salta el envío y
 *     loguea el contenido (fallback). NO se persiste en la queue —
 *     no es un fallo real, es "modo offline" intencional.
 *
 * Métodos públicos `enviarCodigoReset` y `enviarVerificacion` delegan
 * al método compartido `enviarConRetry` que es el que tiene la anotación.
 * Spring Retry funciona vía proxy, así que la auto-invocación dentro del
 * mismo bean NO dispara los retries — por eso el método retryable es
 * público y se llama directamente desde fuera (vía @Async desde los
 * métodos wrapper).
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_BASE = "https://api.resend.com";

    private final RestClient restClient;
    private final EmailFailureRepository emailFailureRepository;
    private final String apiKey;
    private final String from;
    private final boolean enabled;

    public EmailService(
            EmailFailureRepository emailFailureRepository,
            @Value("${email.resend.api-key:}") String apiKey,
            @Value("${email.resend.from:onboarding@resend.dev}") String from) {
        this.emailFailureRepository = emailFailureRepository;
        this.apiKey = apiKey;
        this.from = from;
        this.enabled = apiKey != null && !apiKey.isBlank();
        this.restClient = RestClient.builder().baseUrl(RESEND_BASE).build();
        if (this.enabled) {
            log.info("EmailService activo vía Resend: from={}", from);
        } else {
            log.warn("EmailService DESACTIVADO (falta RESEND_API_KEY). Mensajes solo se logean en consola.");
        }
    }

    /** Reset de password (Plan v2 §1.3). */
    @Async("emailExecutor")
    public void enviarCodigoReset(String to, String username, String codigo) {
        String subject = "AnimeShowdown — Código para restablecer tu contraseña";
        String text = "Hola " + username + ",\n\n" +
                "Tu código para restablecer la contraseña es:\n\n" +
                "    " + codigo + "\n\n" +
                "El código expira en 15 minutos. Si no fuiste tú, ignora este mensaje.\n\n" +
                "— AnimeShowdown";
        enviarConRetry(EmailTipo.RESET_PASSWORD, to, subject, text);
    }

    /** Verificación de email post-registro (Plan v2 §2.4). */
    @Async("emailExecutor")
    public void enviarVerificacion(String to, String username, String linkVerificacion) {
        String subject = "AnimeShowdown — Verifica tu email";
        String text = "¡Bienvenido " + username + "!\n\n" +
                "Para activar tu cuenta y poder votar en los torneos, confirma tu email:\n\n" +
                linkVerificacion + "\n\n" +
                "El enlace caduca en 24 horas. Si no fuiste tú quien se registró, ignora este mensaje.\n\n" +
                "— AnimeShowdown";
        enviarConRetry(EmailTipo.VERIFICACION, to, subject, text);
    }

    /**
     * Núcleo del envío con retry. Es público para que el proxy de Spring
     * Retry funcione cuando los métodos wrapper @Async lo llaman.
     *
     * Reintentos: 3, backoff 1s, 2s, 4s (multiplier 2). Si en el 3º intento
     * Resend sigue fallando, @Recover persiste el contenido en la dead
     * letter queue para diagnóstico/reintento manual.
     *
     * Marcamos value=Exception.class para retry sobre cualquier excepción
     * (incluida RuntimeException) — Resend puede fallar de formas variadas
     * (timeout, 5xx, 429, network drop) y todas justifican reintento.
     */
    @Retryable(
            retryFor = Exception.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 1000, multiplier = 2.0))
    public void enviarConRetry(EmailTipo tipo, String to, String subject, String text) {
        if (!enabled) {
            log.warn("[EMAIL FALLBACK] {} a {}: subject={} (modo offline, RESEND_API_KEY no configurada)",
                    tipo, to, subject);
            return;
        }
        Map<String, Object> body = Map.of(
                "from", from,
                "to", List.of(to),
                "subject", subject,
                "text", text);
        restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
        log.info("Email {} enviado a {} vía Resend", tipo, to);
    }

    /**
     * Recover: se ejecuta cuando @Retryable agotó sus 3 intentos. Persiste
     * el contenido en email_failed_queue para que el admin pueda
     * inspeccionarlo y reintentar manualmente.
     *
     * El @Recover NUNCA lanza — perder un email es malo, pero romper la
     * request que lo originó (login, registro) es peor. Si la BBDD también
     * falla, solo logueamos.
     */
    @Recover
    public void onEnvioFallido(Exception ex, EmailTipo tipo, String to, String subject, String text) {
        log.error("EmailService: fallo tras 3 reintentos. tipo={} to={} error={}",
                tipo, to, ex.getMessage());
        try {
            emailFailureRepository.save(new EmailFailure(tipo, to, subject, text, ex.getMessage()));
        } catch (Exception persistError) {
            log.error("EmailService: NO se pudo persistir el fallo en email_failed_queue: {}",
                    persistError.getMessage());
        }
    }
}
