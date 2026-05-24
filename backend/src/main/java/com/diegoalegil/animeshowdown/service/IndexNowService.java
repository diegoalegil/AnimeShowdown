package com.diegoalegil.animeshowdown.service;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Cliente de IndexNow — protocolo conjunto de Bing,
 * Yandex y otros para que los crawlers recojan URLs nuevas/actualizadas
 * al instante en lugar de esperar al recrawl natural.
 *
 * <p>Google no es signatario formal del protocolo, pero recibe la señal
 * de forma indirecta (Bing comparte con Google) y muchos crawlers menores
 * la consumen, así que la cobertura efectiva es alta.
 *
 * <p>Cómo activarlo en producción:
 * <ol>
 *   <li>Generar una clave UUID: {@code openssl rand -hex 16}.</li>
 *   <li>Crear {@code frontend/public/{KEY}.txt} con el contenido = la
 *       propia clave (verificación de propiedad del dominio).</li>
 *   <li>Definir env vars en Railway: {@code INDEXNOW_KEY=<uuid>}
 *       y {@code INDEXNOW_HOST=animeshowdown.dev}.</li>
 *   <li>Listo. Cada ping llama a {@code https://api.indexnow.org/IndexNow}
 *       con el host, la clave y la lista de URLs.</li>
 * </ol>
 *
 * <p>Sin {@code INDEXNOW_KEY} configurada el service no hace nada — útil
 * en dev y CI para no hacer requests innecesarios. Loguea WARN solo en
 * fallos (la indexación no es crítica).
 */
@Service
public class IndexNowService {

    private static final Logger log = LoggerFactory.getLogger(IndexNowService.class);
    private static final String ENDPOINT = "https://api.indexnow.org/IndexNow";

    private final RestClient restClient;
    private final String key;
    private final String host;
    private final String baseUrl;

    public IndexNowService(
            @Value("${app.indexnow.key:}") String key,
            @Value("${app.indexnow.host:animeshowdown.dev}") String host,
            @Value("${app.indexnow.base-url:https://animeshowdown.dev}") String baseUrl) {
        this.key = key;
        this.host = host;
        this.baseUrl = baseUrl;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(3).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(5).toMillis());
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .build();

        if (key == null || key.isBlank()) {
            log.info("IndexNow desactivado: app.indexnow.key no configurada (dev/CI normal)");
        } else {
            log.info("IndexNow activo: host={} keyPrefix={}*** baseUrl={}",
                    host, key.substring(0, Math.min(6, key.length())), baseUrl);
        }
    }

    /**
     * Notifica a IndexNow una o varias URLs nuevas/actualizadas.
     *
     * <p>Async + best-effort: si el endpoint tarda o falla, el negocio
     * (aprobar torneo, cron auto-tournament) sigue su flujo. Nunca lanza.
     *
     * @param rutas paths absolutos relativos al dominio (ej. "/torneos/best-girls-2026")
     */
    @Async
    public void notificar(List<String> rutas) {
        if (key == null || key.isBlank() || rutas == null || rutas.isEmpty()) {
            return;
        }
        List<String> urlList = rutas.stream()
                .map((r) -> r.startsWith("http") ? r : baseUrl + (r.startsWith("/") ? r : "/" + r))
                .toList();

        Map<String, Object> body = Map.of(
                "host", host,
                "key", key,
                "keyLocation", baseUrl + "/" + key + ".txt",
                "urlList", urlList);

        try {
            restClient.post()
                    .uri(ENDPOINT)
                    .header("Content-Type", "application/json; charset=utf-8")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("IndexNow ping OK: {} url(s) notificadas", urlList.size());
        } catch (Exception e) {
            // 202 sin body, 200, o cualquier error de red — best-effort.
            log.warn("IndexNow ping falló ({}): {}", e.getClass().getSimpleName(), e.getMessage());
        }
    }

    /** Atajo para 1 URL. */
    @Async
    public void notificarUna(String ruta) {
        notificar(List.of(ruta));
    }
}
