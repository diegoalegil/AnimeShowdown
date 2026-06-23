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
 *   - GET /api/og/ranking.png
 *   - GET /api/og/anime/{slug}.png
 *   - GET /api/og/pvp.png
 *   - GET /api/og/duelo/{slugA}/vs/{slugB}.png
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

    @GetMapping(value = "/ranking.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> ranking() {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderRanking());
    }

    @GetMapping(value = "/home.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> home() {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderHome());
    }

    @GetMapping(value = "/anime/{slug}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> anime(@PathVariable String slug) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderAnime(slug));
    }

    @GetMapping(value = "/pvp.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> pvp() {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderPvp());
    }

    @GetMapping(value = "/duelo/{slugA}/vs/{slugB}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> duelo(@PathVariable String slugA, @PathVariable String slugB) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderDuelo(slugA, slugB));
    }

    @GetMapping(value = "/tier-list/{slug}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> tierList(@PathVariable String slug) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(ogImageService.renderTierList(slug));
    }

    /**
     * OG de perfil de usuario (B7 §1b). A diferencia del resto, devuelve 404
     * si el usuario no existe (renderUsuario → null) en vez de un fallback,
     * para no inventar previews de perfiles inexistentes.
     */
    @GetMapping(value = "/usuario/{username}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> usuario(@PathVariable String username) {
        byte[] png = ogImageService.renderUsuario(username);
        if (png == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CACHE_7_DIAS)
                .body(png);
    }
}
