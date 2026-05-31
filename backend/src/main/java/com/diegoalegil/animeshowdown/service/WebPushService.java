package com.diegoalegil.animeshowdown.service;

import java.nio.charset.StandardCharsets;
import java.security.Security;

import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.PushSubscription;
import com.fasterxml.jackson.databind.ObjectMapper;

import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;

@Service
public class WebPushService {

    private static final Logger log = LoggerFactory.getLogger(WebPushService.class);
    private static final int TTL_SECONDS = 60 * 60 * 6;

    private final ObjectMapper objectMapper;
    private final String publicKey;
    private final PushService pushService;
    private final boolean enabled;

    public WebPushService(
            ObjectMapper objectMapper,
            @Value("${app.push.vapid.public-key:}") String publicKey,
            @Value("${app.push.vapid.private-key:}") String privateKey,
            @Value("${app.push.vapid.subject:mailto:diegogildam@gmail.com}") String subject) {
        this.objectMapper = objectMapper;
        this.publicKey = sanitize(publicKey);
        String privateKeyClean = sanitize(privateKey);
        if (this.publicKey.isBlank() || privateKeyClean.isBlank()) {
            this.enabled = false;
            this.pushService = null;
            log.info("Web Push desactivado: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configuradas");
            return;
        }

        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            this.pushService = new PushService(this.publicKey, privateKeyClean, subject);
            this.enabled = true;
            log.info("Web Push activado con VAPID subject={}", subject);
        } catch (Exception e) {
            throw new IllegalStateException("Configuracion VAPID invalida", e);
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String publicKey() {
        return publicKey;
    }

    public WebPushResult enviar(PushSubscription subscription, WebPushPayload payload) {
        if (!enabled || pushService == null) {
            return WebPushResult.disabled();
        }
        try {
            byte[] body = objectMapper.writeValueAsString(payload)
                    .getBytes(StandardCharsets.UTF_8);
            Notification notification = new Notification(
                    subscription.getEndpoint(),
                    subscription.getP256dh(),
                    subscription.getAuth(),
                    body,
                    TTL_SECONDS);
            HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();
            return new WebPushResult(true, status, status == 404 || status == 410);
        } catch (Exception e) {
            log.warn("Web Push fallo para endpoint={}: {}", redact(subscription.getEndpoint()), e.getMessage());
            return WebPushResult.failed();
        }
    }

    private static String sanitize(String value) {
        return value == null ? "" : value.trim();
    }

    private static String redact(String endpoint) {
        if (endpoint == null || endpoint.length() < 24) return "(endpoint)";
        return endpoint.substring(0, 16) + "...";
    }

    public record WebPushPayload(String title, String body, String url, String tag) {
    }

    public record WebPushResult(boolean attempted, int statusCode, boolean removeSubscription) {
        static WebPushResult disabled() {
            return new WebPushResult(false, 0, false);
        }

        static WebPushResult failed() {
            return new WebPushResult(true, 0, false);
        }
    }
}
