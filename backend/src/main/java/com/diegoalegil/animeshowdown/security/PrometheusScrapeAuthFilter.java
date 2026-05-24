package com.diegoalegil.animeshowdown.security;

import java.io.IOException;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Filtro de autenticación dedicado para {@code /actuator/prometheus}.
 *
 * <p>antes el endpoint estaba en permitAll,
 * lo que filtraba métricas internas (endpoints, latencias, tasas de error,
 * nombres de queries) a cualquier visitante. Estas señales son ORO para un
 * atacante que quiera mapear la superficie del backend o detectar incidentes
 * activos para amplificar.
 *
 * <p>Patrón equivalente al de {@code /api/cron/**}: el caller (el job de
 * Prometheus) envía un secret en el header {@code X-Prometheus-Token}. El
 * filtro lo compara contra {@code app.prometheus.scrape-token} configurado
 * por env var. Modo seguro por defecto: si el secret no está configurado o
 * el header no matchea, responde 401 sin tocar el endpoint.
 *
 * <p>Configurar en Railway / docker compose:
 * <pre>
 *   APP_PROMETHEUS_SCRAPE_TOKEN=$(openssl rand -hex 32)
 * </pre>
 * Y en el job de Prometheus:
 * <pre>
 *   - job_name: animeshowdown
 *     metrics_path: /actuator/prometheus
 *     static_configs:
 *       - targets: ['api.animeshowdown.dev']
 *     http_headers:
 *       X-Prometheus-Token: ['<token>']
 * </pre>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class PrometheusScrapeAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(PrometheusScrapeAuthFilter.class);
    private static final String PROMETHEUS_PATH = "/actuator/prometheus";
    private static final String TOKEN_HEADER = "X-Prometheus-Token";

    private final String expectedToken;
    private final boolean hasToken;

    public PrometheusScrapeAuthFilter(
            @Value("${app.prometheus.scrape-token:}") String configuredToken) {
        String trimmed = configuredToken == null ? "" : configuredToken.trim();
        this.expectedToken = trimmed;
        this.hasToken = !trimmed.isEmpty();
        if (!this.hasToken) {
            log.warn("PrometheusScrapeAuthFilter: app.prometheus.scrape-token no configurado. "
                    + "/actuator/prometheus devolverá 401 a todos los requests "
                    + "(fail-closed). Para habilitar scraping, set APP_PROMETHEUS_SCRAPE_TOKEN.");
        } else {
            log.info("PrometheusScrapeAuthFilter inicializado: token configurado, {} chars",
                    trimmed.length());
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!PROMETHEUS_PATH.equals(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        if (!hasToken) {
            // Modo fail-closed: si nadie configuró el token, no exponemos
            // métricas. Mejor "feature off" que "feature open by default".
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setHeader("WWW-Authenticate", "X-Prometheus-Token");
            return;
        }
        String provided = request.getHeader(TOKEN_HEADER);
        if (provided == null || !secureEquals(provided, expectedToken)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setHeader("WWW-Authenticate", "X-Prometheus-Token");
            return;
        }
        filterChain.doFilter(request, response);
    }

    /**
     * Comparación constant-time para no filtrar el largo del token por timing.
     * MessageDigest.isEqual ya es timing-safe en JDK moderno.
     */
    private static boolean secureEquals(String a, String b) {
        byte[] ba = a.getBytes(StandardCharsets.UTF_8);
        byte[] bb = b.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(ba, bb);
    }
}
