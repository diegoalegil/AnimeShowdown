package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.concurrent.ThreadLocalRandom;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Tests del clasificador "blanco y negro vs color" usado para filtrar
 * paneles de manga (escaneos grises) de los frames de anime en la
 * galería de personaje. Valida {@link JikanService#analyzeHasColor}
 * con BufferedImages generados in-memory — sin red, sin Jikan, sin
 * dependencias externas.
 *
 * <p>El umbral actual: máximo 75% de pixels grises (delta R/G/B < 18).
 */
@SpringBootTest
@ActiveProfiles("test")
class JikanColorFilterTest {

    @Autowired private JikanService jikanService;

    @Test
    void imagenSolidaColorEsColor() {
        BufferedImage img = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 200; y++) {
            for (int x = 0; x < 200; x++) {
                img.setRGB(x, y, new Color(220, 40, 90).getRGB()); // magenta vivo
            }
        }
        assertTrue(jikanService.analyzeHasColor(img),
                "Imagen sólida magenta debería clasificarse como color");
    }

    @Test
    void imagenGrayscaleEsBlancoNegro() {
        // Cada pixel R==G==B con valor random — grayscale puro.
        BufferedImage img = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 200; y++) {
            for (int x = 0; x < 200; x++) {
                int v = ThreadLocalRandom.current().nextInt(256);
                img.setRGB(x, y, new Color(v, v, v).getRGB());
            }
        }
        assertFalse(jikanService.analyzeHasColor(img),
                "Imagen grayscale pura debería clasificarse como B&W");
    }

    @Test
    void imagenCasiGrayscaleSiguteSiendoBn() {
        // Manga panel típico: variación de ±2 sobre el gris (compresión JPEG
        // introduce algo de noise) — debería seguir siendo B&W.
        BufferedImage img = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 200; y++) {
            for (int x = 0; x < 200; x++) {
                int base = ThreadLocalRandom.current().nextInt(256);
                int r = clamp(base + ThreadLocalRandom.current().nextInt(-2, 3));
                int g = clamp(base + ThreadLocalRandom.current().nextInt(-2, 3));
                int b = clamp(base + ThreadLocalRandom.current().nextInt(-2, 3));
                img.setRGB(x, y, new Color(r, g, b).getRGB());
            }
        }
        assertFalse(jikanService.analyzeHasColor(img),
                "Manga panel con noise mínimo de JPEG debe seguir siendo B&W");
    }

    @Test
    void escenaOscuraConTinteSigueSiendoColor() {
        // Escena nocturna anime: azul oscuro dominante. R<<G<<B con
        // diferencia notable. Debe clasificarse como color, no B&W.
        BufferedImage img = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 200; y++) {
            for (int x = 0; x < 200; x++) {
                int r = ThreadLocalRandom.current().nextInt(20, 50);
                int g = ThreadLocalRandom.current().nextInt(40, 80);
                int b = ThreadLocalRandom.current().nextInt(90, 140);
                img.setRGB(x, y, new Color(r, g, b).getRGB());
            }
        }
        assertTrue(jikanService.analyzeHasColor(img),
                "Escena nocturna con tinte azul debe ser color");
    }

    @Test
    void imagenMixtaCon50PorcentoColorEsColor() {
        // Mitad gris, mitad color → ratio gris ≈ 50% → bajo el threshold
        // 75% → se mantiene como color.
        BufferedImage img = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 200; y++) {
            for (int x = 0; x < 200; x++) {
                if (x < 100) {
                    int v = ThreadLocalRandom.current().nextInt(256);
                    img.setRGB(x, y, new Color(v, v, v).getRGB());
                } else {
                    img.setRGB(x, y, new Color(200, 60, 120).getRGB());
                }
            }
        }
        assertTrue(jikanService.analyzeHasColor(img),
                "50/50 gris-color debe contar como color (threshold 75%)");
    }

    private int clamp(int v) {
        return Math.max(0, Math.min(255, v));
    }
}
