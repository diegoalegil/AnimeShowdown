package com.diegoalegil.animeshowdown.controller;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.service.TorneoAutoService;

/**
 * Endpoint cron-only para auto-generar torneos (auditoría P2.10 2026-05-17).
 *
 * <p>El workflow {@code .github/workflows/auto-tournament.yml} antes hacía
 * login con username/password de admin y usaba el JWT. Si el admin activa
 * 2FA TOTP, ese login devuelve un challenge en lugar del token y el cron
 * se rompe (el código TOTP cambia cada 30s, no se puede automatizar).
 *
 * <p>Solución: este endpoint vive fuera de {@code /api/admin/**} y se
 * autentica con un secret shared en el header {@code X-Cron-Secret},
 * configurable vía env var {@code APP_CRON_SECRET}. Sin secret válido
 * → 401. Con secret válido → mismas validaciones de idempotencia y
 * estado del {@link TorneoAutoService} que el endpoint admin original.
 *
 * <p>El secret debe rotarse periódicamente (recomendado cada 6 meses)
 * actualizando el secret en GitHub Actions y la env var en Railway.
 *
 * <p>El endpoint admin original {@code /api/admin/torneos/auto-generar}
 * se mantiene para invocación manual desde Swagger UI o cualquier
 * cliente admin con sesión real.
 */
@RestController
@RequestMapping("/api/cron/torneos")
public class CronTorneoController {

    private static final Logger log = LoggerFactory.getLogger(CronTorneoController.class);
    private static final String SECRET_HEADER = "X-Cron-Secret";

    private final TorneoAutoService autoService;
    private final String expectedSecret;

    public CronTorneoController(TorneoAutoService autoService,
            @Value("${app.cron.secret:}") String expectedSecret) {
        this.autoService = autoService;
        this.expectedSecret = expectedSecret == null ? "" : expectedSecret.trim();
        if (this.expectedSecret.isEmpty()) {
            log.warn("CronTorneoController: APP_CRON_SECRET no configurado — el endpoint devolverá 401 a todas las llamadas. Configurar en producción.");
        }
    }

    @PostMapping("/auto-generar")
    public ResponseEntity<?> autoGenerar(
            @RequestHeader(value = SECRET_HEADER, required = false) String providedSecret,
            @RequestBody(required = false) Map<String, Object> body) {
        if (expectedSecret.isEmpty() || providedSecret == null
                || !constantTimeEquals(expectedSecret, providedSecret.trim())) {
            log.warn("CronTorneoController: intento de auto-generar con secret inválido o sin secret");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Cron secret inválido o no configurado"));
        }
        if (!autoService.isEnabled()) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("error", "Auto-generación deshabilitada");
            resp.put("hint", "Activa con app.tournament.auto.enabled=true en application.properties");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(resp);
        }

        int tamano = 8;
        boolean force = false;
        if (body != null) {
            Object t = body.get("tamano");
            if (t instanceof Number) tamano = ((Number) t).intValue();
            Object f = body.get("force");
            if (f instanceof Boolean) force = (Boolean) f;
        }

        try {
            Torneo creado = autoService.generar(tamano, force);
            log.info("CronTorneoController: torneo auto-generado id={} nombre={}",
                    creado.getId(), creado.getNombre());
            return ResponseEntity.status(HttpStatus.CREATED).body(creado);
        } catch (TorneoAutoService.IdempotenciaException e) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("error", e.getMessage());
            resp.put("torneo_existente", e.getExistente());
            resp.put("hint", "Pasa force=true en el body para forzar otro torneo");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(resp);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Comparación constant-time para evitar timing attacks sobre el
     * secret. Delega en {@link java.security.MessageDigest#isEqual} que
     * es la implementación canónica constant-time del JDK (mantiene el
     * mismo tiempo de ejecución independientemente de dónde difieran
     * los bytes — el early return por null ya no es vector).
     *
     * <p>Audit (2026-05-17): la implementación manual previa hacía un
     * {@code if (a == null || b == null) return false;} antes del loop
     * que permitía distinguir por timing "secret null" vs "secret
     * wrong". MessageDigest.isEqual cubre ambos casos uniformemente
     * (sigue O(max(len(a),len(b))) sin early exit).
     */
    private static boolean constantTimeEquals(String a, String b) {
        byte[] ab = a == null ? new byte[0] : a.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] bb = b == null ? new byte[0] : b.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        // null vs null pasa como match — el caller debe verificar non-blank antes.
        if (ab.length == 0 && bb.length == 0) return false;
        return java.security.MessageDigest.isEqual(ab, bb);
    }
}
