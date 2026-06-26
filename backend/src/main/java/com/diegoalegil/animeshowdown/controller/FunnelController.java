package com.diegoalegil.animeshowdown.controller;

import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
 * <p>Diseño defensivo: endpoint público sin auth pero (a) rate-limitado en
 * {@code RateLimitFilter} (policy {@code funnel}) y (b) con el nombre del evento
 * validado contra un <b>whitelist</b> cerrado — así la cardinalidad del tag de
 * Prometheus está acotada (un nombre arbitrario reventaría la métrica con series
 * infinitas). No persiste nada por usuario: solo incrementa un contador
 * agregado, sin PII ni cookie.
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
    public ResponseEntity<Void> evento(@RequestBody(required = false) FunnelEventRequest req) {
        if (req != null && req.event() != null && EVENTOS_PERMITIDOS.contains(req.event())) {
            metrics.clientEvent(req.event());
        }
        // Siempre 204: fire-and-forget. No diferenciamos por status si el evento
        // entró o no en el whitelist (no filtramos la lista hacia fuera).
        return ResponseEntity.noContent().build();
    }

    public record FunnelEventRequest(String event) {
    }
}
