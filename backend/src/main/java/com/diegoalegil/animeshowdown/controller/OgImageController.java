package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.service.OgImageService;

import java.time.Duration;

/**
 * Endpoints que sirven PNGs 1200x630 pre-renderizados para previews
 * sociales (Twitter Cards, OpenGraph, Discord, Slack). 2.
 *
 * URLs canonical:
 *   - GET /api/og/personaje/{slug}.png
 *   - GET /api/og/torneo/{slug}.png
 *
 * Headers:
 *   - Content-Type: image/png
 *   - Cache-Control: public, max-age=604800 (7 días, alineado con el TTL
 *     del cache Caffeine en OgImageService). Cloudflare cachea aguas
 *     arriba del backend, así que un slug popular solo entra al backend
 *     una vez por semana.
 *
 * Acceso público sin auth (SecurityConfig.permitAll /api/og/**) porque
 * estos PNGs los consume cualquier crawler del mundo (Twitter, Reddit,
 * Slack, etc.) sin tokens.
 */
@RestController
@RequestMapping("/api/og")
public class OgImageController {

    private static final CacheControl CACHE_7_DIAS = CacheControl
            .maxAge(Duration.ofDays(7))
            .cachePublic();

    private final OgImageService ogImageService;

    public OgImageController(OgImageService ogImageService) {
        this.ogImageService = ogImageService;
    }

    @GetMapping(value = "/personaje/{slug}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> personaje(@PathVariable String slug) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderPersonaje(slug));
    }

    @GetMapping(value = "/torneo/{slug}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> torneo(@PathVariable String slug) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderTorneo(slug));
    }
}
