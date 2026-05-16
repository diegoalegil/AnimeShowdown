package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.NewsletterSubRequest;
import com.diegoalegil.animeshowdown.service.NewsletterService;
import com.diegoalegil.animeshowdown.service.NewsletterService.ResultadoSuscripcion;

import jakarta.validation.Valid;

/**
 * Endpoints REST de newsletter con double opt-in (Plan v2 §4.8).
 *
 * <ul>
 *   <li>{@code POST /api/newsletter} — público. Body {email}. Crea o
 *       refresca la suscripción y dispara email de confirmación.</li>
 *   <li>{@code GET /api/newsletter/confirmar?token=...} — público. Marca
 *       la suscripción como confirmada.</li>
 *   <li>{@code POST /api/newsletter/unsubscribe?token=...} — público.
 *       Borra la suscripción a partir del token-unsubscribe persistente.</li>
 * </ul>
 *
 * <p>El POST {@code /} responde 200 incluso cuando el email ya está
 * confirmado, para no filtrar info a un atacante haciendo enumeración.
 */
@RestController
@RequestMapping("/api/newsletter")
public class NewsletterController {

    @SuppressWarnings("unused")
    private static final Logger log = LoggerFactory.getLogger(NewsletterController.class);

    private final NewsletterService newsletterService;

    public NewsletterController(NewsletterService newsletterService) {
        this.newsletterService = newsletterService;
    }

    @PostMapping
    public ResponseEntity<?> suscribir(@Valid @RequestBody NewsletterSubRequest req) {
        try {
            ResultadoSuscripcion r = newsletterService.suscribir(req.getEmail());
            String mensaje = switch (r) {
                case CREADA -> "Te hemos enviado un email para confirmar la suscripción. Revisa tu bandeja.";
                case REENVIADA -> "Te hemos reenviado el email de confirmación. Revisa tu bandeja.";
                case YA_CONFIRMADA -> "Ya estás suscrito a la newsletter.";
            };
            return ResponseEntity.ok(Map.of("message", mensaje, "estado", r.name()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/confirmar")
    public ResponseEntity<?> confirmar(@RequestParam String token) {
        boolean ok = newsletterService.confirmar(token);
        if (ok) {
            return ResponseEntity.ok(Map.of(
                    "message", "Suscripción confirmada. ¡Gracias!",
                    "confirmado", true));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of(
                        "message", "Token inválido o expirado. Vuelve a pedir el email de confirmación.",
                        "confirmado", false));
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(@RequestParam String token) {
        boolean ok = newsletterService.unsubscribir(token);
        if (ok) {
            return ResponseEntity.ok(Map.of("message", "Te has dado de baja correctamente."));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "Token de unsubscribe inválido."));
    }
}
