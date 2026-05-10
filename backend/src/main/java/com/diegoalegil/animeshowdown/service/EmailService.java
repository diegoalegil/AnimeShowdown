package com.diegoalegil.animeshowdown.service;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_BASE = "https://api.resend.com";

    private final RestClient restClient;
    private final String apiKey;
    private final String from;
    private final boolean enabled;

    public EmailService(
            @Value("${email.resend.api-key:}") String apiKey,
            @Value("${email.resend.from:onboarding@resend.dev}") String from) {
        this.apiKey = apiKey;
        this.from = from;
        this.enabled = apiKey != null && !apiKey.isBlank();
        this.restClient = RestClient.builder().baseUrl(RESEND_BASE).build();
        if (this.enabled) {
            log.info("EmailService activo vía Resend: from={}", from);
        } else {
            log.warn("EmailService DESACTIVADO (falta RESEND_API_KEY). Códigos de reset se logean en consola.");
        }
    }

    @Async
    public void enviarCodigoReset(String to, String username, String codigo) {
        if (!enabled) {
            log.warn("[EMAIL FALLBACK] Reset code para {} ({}): {}", to, username, codigo);
            return;
        }
        try {
            Map<String, Object> body = Map.of(
                    "from", from,
                    "to", List.of(to),
                    "subject", "AnimeShowdown — Código para restablecer tu contraseña",
                    "text",
                    "Hola " + username + ",\n\n" +
                    "Tu código para restablecer la contraseña es:\n\n" +
                    "    " + codigo + "\n\n" +
                    "El código expira en 15 minutos. Si no fuiste tú, ignora este mensaje.\n\n" +
                    "— AnimeShowdown");
            restClient.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Email de reset enviado a {} vía Resend", to);
        } catch (Exception e) {
            log.error("Error Resend a {}: {} (código actual: {})", to, e.getMessage(), codigo);
        }
    }
}
