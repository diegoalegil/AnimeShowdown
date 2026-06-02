package com.diegoalegil.animeshowdown.security;

import java.net.IDN;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class WebPushEndpointGuard {

    public static final int MAX_ENDPOINT_LENGTH = 2048;
    public static final String DEFAULT_ALLOWED_HOSTS = "fcm.googleapis.com,"
            + "updates.push.services.mozilla.com,"
            + "*.push.services.mozilla.com,"
            + "webpush.push.apple.com,"
            + "*.push.apple.com,"
            + "*.notify.windows.com";

    private final List<String> allowedHosts;

    public WebPushEndpointGuard(
            @Value("${app.push.allowed-endpoint-hosts:" + DEFAULT_ALLOWED_HOSTS + "}") String allowedHosts) {
        this.allowedHosts = parseAllowedHosts(allowedHosts);
    }

    public String requireAllowed(String endpoint) {
        Validation validation = validate(endpoint);
        if (!validation.allowed()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, validation.reason());
        }
        return endpoint.trim();
    }

    public boolean isAllowed(String endpoint) {
        return validate(endpoint).allowed();
    }

    private Validation validate(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            return Validation.reject("Endpoint push requerido");
        }
        String trimmed = endpoint.trim();
        if (trimmed.length() > MAX_ENDPOINT_LENGTH) {
            return Validation.reject("Endpoint push demasiado largo");
        }

        final URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException ex) {
            return Validation.reject("Endpoint push invalido");
        }

        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            return Validation.reject("Endpoint push debe usar HTTPS");
        }
        if (uri.getUserInfo() != null || uri.getRawFragment() != null) {
            return Validation.reject("Endpoint push invalido");
        }
        if (uri.getPort() != -1 && uri.getPort() != 443) {
            return Validation.reject("Endpoint push usa un puerto no permitido");
        }

        String host = normalizeHost(uri.getHost());
        if (host == null || host.isBlank()) {
            return Validation.reject("Endpoint push sin host valido");
        }
        if (SsrfGuard.isBlockedLiteralHost(host)) {
            return Validation.reject("Endpoint push apunta a una red no permitida");
        }
        if (!hostAllowed(host)) {
            return Validation.reject("Proveedor Web Push no permitido");
        }
        String rawPath = uri.getRawPath();
        if (rawPath == null || rawPath.isBlank() || "/".equals(rawPath)) {
            return Validation.reject("Endpoint push sin ruta de suscripcion");
        }
        return Validation.accept();
    }

    private boolean hostAllowed(String host) {
        for (String pattern : allowedHosts) {
            if (pattern.startsWith("*.")) {
                String suffix = pattern.substring(1);
                if (host.endsWith(suffix) && host.length() > suffix.length()) {
                    return true;
                }
            } else if (host.equals(pattern)) {
                return true;
            }
        }
        return false;
    }

    private static List<String> parseAllowedHosts(String value) {
        return Arrays.stream((value == null ? "" : value).split(","))
                .map(WebPushEndpointGuard::normalizeHost)
                .filter(host -> host != null && !host.isBlank())
                .toList();
    }

    private static String normalizeHost(String host) {
        if (host == null) {
            return null;
        }
        String clean = host.trim();
        if (clean.startsWith("*.") && clean.length() > 2) {
            return "*." + normalizeHost(clean.substring(2));
        }
        try {
            return IDN.toASCII(clean, IDN.USE_STD3_ASCII_RULES)
                    .toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private record Validation(boolean allowed, String reason) {
        static Validation accept() {
            return new Validation(true, "");
        }

        static Validation reject(String reason) {
            return new Validation(false, reason);
        }
    }
}
