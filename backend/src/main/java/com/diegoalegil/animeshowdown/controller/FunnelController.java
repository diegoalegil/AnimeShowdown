package com.diegoalegil.animeshowdown.controller;

import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.service.AnimeShowdownMetrics;

/**
 * Beacon de eventos de embudo client-side.
 *
 * <p>El servidor ya cuenta registro→verificación→voto (AnimeShowdownMetrics),
 * pero hay pasos del funnel que solo ocurren en el navegador y que el backend
 * no ve: la visita a la home, el muro de 5 votos del invitado, el click de
 * compartir y la llegada con código de referido. El frontend los reporta aquí
 * vía {@code navigator.sendBeacon} (anónimo, fire-and-forget) y se agregan en
 * el Prometheus que ya existe, sin depender de ninguna herramienta de analítica
 * de terceros (que se podrá añadir luego como sink adicional).
 *
 * <p>Diseño defensivo:
 * <ul>
 *   <li>Endpoint público sin auth pero rate-limitado en {@code RateLimitFilter}
 *       (policy {@code funnel}).</li>
 *   <li>El nombre del evento va en el query param {@code e} y se valida contra un
 *       <b>whitelist</b> cerrado — la cardinalidad del tag de Prometheus queda
 *       acotada (un nombre arbitrario reventaría la métrica con series infinitas).</li>
 *   <li>Sin cuerpo de petición: el evento es un query param, no un
 *       {@code @RequestBody}. Así {@code sendBeacon} (que por defecto manda
 *       {@code text/plain}) no provoca un 415/500 con stack-trace por
 *       content-type — el endpoint SIEMPRE responde 204, de verdad
 *       fire-and-forget, sea cual sea el cliente.</li>
 *   <li>No persiste nada por usuario: solo incrementa un contador agregado, sin
 *       PII ni cookie.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/funnel")
public class FunnelController {

    /**
     * Eventos client-side aceptados. Cerrado a propósito: cualquier nombre
     * fuera de esta lista se ignora en silencio (no cuenta, no error) para no
     * abrir la cardinalidad de la métrica a entradas arbitrarias.
     */
    private static final Set<String> EVENTOS_PERMITIDOS = Set.of(
            "landing_view",
            "vote_wall_hit",
            "share_click",
            "referral_landing",
            "register_start");

    private final AnimeShowdownMetrics metrics;

    public FunnelController(AnimeShowdownMetrics metrics) {
        this.metrics = metrics;
    }

    @PostMapping("/event")
    public ResponseEntity<Void> evento(@RequestParam(name = "e", required = false) String event) {
        if (event != null && EVENTOS_PERMITIDOS.contains(event)) {
            metrics.clientEvent(event);
        } else if (event != null && !event.isBlank()) {
            // Nombre fuera del whitelist: lo contamos en un contador de tag FIJO
            // (una sola serie, cardinalidad acotada) para detectar drift
            // cliente↔backend. null/vacío = sin evento, no cuenta.
            metrics.clientEventRechazado();
        }
        // Siempre 204: fire-and-forget. No diferenciamos por status si el evento
        // entró o no en el whitelist (no filtramos la lista hacia fuera).
        return ResponseEntity.noContent().build();
    }
}
