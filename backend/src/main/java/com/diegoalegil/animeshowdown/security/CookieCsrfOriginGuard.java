package com.diegoalegil.animeshowdown.security;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.cors.CorsConfiguration;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Valida Origin/Referer en endpoints que mutan una cookie ambient.
 *
 * <p>La API usa JWT stateless para casi todo y mantiene CSRF global
 * desactivado, pero refresh/logout dependen de una cookie httpOnly que el
 * navegador adjunta automáticamente. Para esos endpoints exigimos que la
 * petición venga de un origen permitido por la misma política CORS pública.
 */
@Service
public class CookieCsrfOriginGuard {

    private final CorsConfiguration corsConfiguration;

    public CookieCsrfOriginGuard(
            @Value("${cors.allowed-origins:}") String allowedOriginsCsv,
            @Value("${cors.allowed-origin-patterns:}") String allowedOriginPatternsCsv) {
        this.corsConfiguration = new CorsConfiguration();
        this.corsConfiguration.setAllowedOrigins(parseCsv(allowedOriginsCsv));
        this.corsConfiguration.setAllowedOriginPatterns(parseCsv(allowedOriginPatternsCsv));
    }

    public boolean isAllowed(HttpServletRequest request) {
        String sourceOrigin = sourceOrigin(request);
        return sourceOrigin != null && corsConfiguration.checkOrigin(sourceOrigin) != null;
    }

    public String sourceOrigin(HttpServletRequest request) {
        if (request == null) return null;
        String origin = clean(request.getHeader("Origin"));
        if (origin != null) return origin;
        String referer = clean(request.getHeader("Referer"));
        if (referer == null) return null;
        try {
            URI uri = URI.create(referer);
            if (uri.getScheme() == null || uri.getHost() == null) return null;
            int port = uri.getPort();
            StringBuilder normalized = new StringBuilder()
                    .append(uri.getScheme().toLowerCase())
                    .append("://")
                    .append(uri.getHost().toLowerCase());
            if (port >= 0) normalized.append(':').append(port);
            return normalized.toString();
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static String clean(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private static List<String> parseCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }
}
