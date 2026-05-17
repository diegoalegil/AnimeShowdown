package com.diegoalegil.animeshowdown.service;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.util.Optional;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

/**
 * Render server-side de OG images (1200×630 PNG) para previews ricos en
 * Twitter/Discord/WhatsApp/Slack. Plan v2 §1.2.
 *
 * Diseño minimalista decidido en planning:
 *   - Fondo dark (#0d0a16) con gradiente magenta sutil arriba-izquierda.
 *   - Foto del personaje a la izquierda, recorte 2:3 ocupando ~45% del ancho.
 *   - Texto a la derecha: nombre grande negrita + anime mediano + logo
 *     "AnimeShowdown" abajo en magenta acento.
 *
 * Cache 7 días vía Caffeine (CacheConfig). Como las imágenes pesan
 * ~150-300KB, 500 entradas son ~100MB max — dentro del presupuesto de
 * Railway. Para mover a CDN en futuro cuando Bloque 15.7 pida pre-cache.
 *
 * I/O:
 *   - Lee imagen del personaje de `app.images.base-url` + `personaje.imagenUrl`
 *     (típicamente `https://animeshowdown.dev/img/Anime/slug.webp`).
 *   - TwelveMonkeys ImageIO decodifica el webp.
 *   - Si la descarga falla devuelve placeholder con solo texto (no 500).
 */
@Service
public class OgImageService {

    private static final Logger log = LoggerFactory.getLogger(OgImageService.class);

    static final int ANCHO = 1200;
    static final int ALTO = 630;
    private static final int FOTO_ANCHO = 540;
    private static final int PADDING = 60;

    private static final Color FONDO = new Color(13, 10, 22);
    private static final Color ACENTO = new Color(255, 46, 99);
    private static final Color TEXTO_PRINCIPAL = new Color(245, 245, 250);
    private static final Color TEXTO_SECUNDARIO = new Color(160, 160, 175);

    private final PersonajeRepository personajeRepository;
    private final TorneoRepository torneoRepository;
    private final String imagesBaseUrl;

    public OgImageService(
            PersonajeRepository personajeRepository,
            TorneoRepository torneoRepository,
            @Value("${app.images.base-url}") String imagesBaseUrl) {
        this.personajeRepository = personajeRepository;
        this.torneoRepository = torneoRepository;
        this.imagesBaseUrl = imagesBaseUrl.endsWith("/")
                ? imagesBaseUrl.substring(0, imagesBaseUrl.length() - 1)
                : imagesBaseUrl;
    }

    /**
     * OG image para `/personajes/{slug}`. Cache key = slug; TTL 7 días.
     * Devuelve Optional vacío si el personaje no existe (404 en controller).
     */
    @Cacheable(value = "og-personaje", key = "#slug", unless = "#result == null || !#result.isPresent()")
    public Optional<byte[]> renderPersonaje(String slug) {
        Optional<Personaje> opt = personajeRepository.findBySlug(slug);
        if (opt.isEmpty()) {
            return Optional.empty();
        }
        Personaje p = opt.get();
        try {
            BufferedImage canvas = nuevoLienzo();
            Graphics2D g = canvas.createGraphics();
            try {
                aplicarHints(g);
                dibujarFondo(g);
                dibujarFoto(g, p.getImagenUrl());
                dibujarTexto(g, p.getNombre(), p.getAnime());
                dibujarLogo(g);
            } finally {
                g.dispose();
            }
            return Optional.of(toPng(canvas));
        } catch (Exception e) {
            log.error("OgImageService.renderPersonaje fallo slug={}: {}", slug, e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * OG image para `/torneos/{slug}`. Comparte template con personaje pero
     * los textos vienen del torneo: nombre arriba, descripción abajo, foto
     * del ganador (si está FINISHED) o del primer participante (resto).
     */
    @Cacheable(value = "og-torneo", key = "#slug", unless = "#result == null || !#result.isPresent()")
    public Optional<byte[]> renderTorneo(String slug) {
        Optional<Torneo> opt = torneoRepository.findBySlug(slug);
        if (opt.isEmpty()) {
            return Optional.empty();
        }
        Torneo t = opt.get();
        // Audit P1 (2026-05-17): torneos PENDIENTE/RECHAZADO no son públicos —
        // generar y servir su OG image filtraría nombre + descripción a
        // cualquier scraper de Open Graph (Twitter, Discord, Slack). Same
        // 404-equivalent que findBySlug/findById ya hacen.
        var rev = t.getEstadoRevision();
        if (rev == com.diegoalegil.animeshowdown.model.EstadoRevision.PENDIENTE
                || rev == com.diegoalegil.animeshowdown.model.EstadoRevision.RECHAZADO) {
            return Optional.empty();
        }
        Personaje imagenFuente = t.getGanadorPersonaje();
        try {
            BufferedImage canvas = nuevoLienzo();
            Graphics2D g = canvas.createGraphics();
            try {
                aplicarHints(g);
                dibujarFondo(g);
                if (imagenFuente != null) {
                    dibujarFoto(g, imagenFuente.getImagenUrl());
                }
                dibujarTexto(g, t.getNombre(), t.getDescripcion() != null ? t.getDescripcion() : "Torneo en AnimeShowdown");
                dibujarLogo(g);
            } finally {
                g.dispose();
            }
            return Optional.of(toPng(canvas));
        } catch (Exception e) {
            log.error("OgImageService.renderTorneo fallo slug={}: {}", slug, e.getMessage(), e);
            return Optional.empty();
        }
    }

    // === helpers de render ===

    private BufferedImage nuevoLienzo() {
        return new BufferedImage(ANCHO, ALTO, BufferedImage.TYPE_INT_RGB);
    }

    private void aplicarHints(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    }

    private void dibujarFondo(Graphics2D g) {
        g.setColor(FONDO);
        g.fillRect(0, 0, ANCHO, ALTO);
        // Gradiente radial sutil del acento desde arriba-izquierda (donde está
        // la foto) hacia el centro — da profundidad sin distraer del texto.
        GradientPaint gradient = new GradientPaint(
                0, 0, new Color(255, 46, 99, 60),
                ANCHO * 0.6f, ALTO * 0.8f, new Color(13, 10, 22, 0));
        g.setPaint(gradient);
        g.fillRect(0, 0, ANCHO, ALTO);
    }

    private void dibujarFoto(Graphics2D g, String imagenUrl) {
        if (imagenUrl == null || imagenUrl.isBlank()) return;
        try {
            String url = imagenUrl.startsWith("http") ? imagenUrl : imagesBaseUrl + imagenUrl;
            BufferedImage foto = leerImagen(url);
            if (foto == null) return;
            // Recorte 2:3 desde el centro de la imagen original (suele ser
            // retrato vertical). El destino mide FOTO_ANCHO de ancho y
            // ALTO - 2*PADDING de alto.
            int destAlto = ALTO - PADDING * 2;
            int destY = PADDING;
            int destX = PADDING;
            g.drawImage(foto, destX, destY, FOTO_ANCHO, destAlto, null);
            // Overlay gradient negro en la parte de abajo para suavizar el
            // borde de la foto contra el fondo si la imagen tiene fondo claro.
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.4f));
            GradientPaint shadow = new GradientPaint(
                    destX, destY + destAlto - 80, new Color(0, 0, 0, 0),
                    destX, destY + destAlto, new Color(0, 0, 0, 200));
            g.setPaint(shadow);
            g.fillRect(destX, destY + destAlto - 80, FOTO_ANCHO, 80);
            g.setComposite(AlphaComposite.SrcOver);
        } catch (Exception e) {
            log.warn("OgImageService.dibujarFoto fallo url={}: {}", imagenUrl, e.getMessage());
        }
    }

    private BufferedImage leerImagen(String url) {
        // Audit P2 (2026-05-17): ImageIO.read(URL) abre HttpURLConnection
        // por debajo SIN timeouts (conn ni read), así que una imagen
        // remota lenta o muerta dejaba el hilo del request OG bloqueado
        // indefinidamente. Esto es accesible por públicos sin auth (OG
        // crawlers de Twitter/Discord), por lo que un atacante podría
        // disparar OG de varios torneos con URLs externas lentas y
        // agotar el pool de Tomcat. Abrimos la conexión manualmente con
        // timeouts conservadores y leemos el stream con ImageIO.
        try {
            URL u = URI.create(url).toURL();
            java.net.URLConnection conn = u.openConnection();
            conn.setConnectTimeout(3_000);
            conn.setReadTimeout(5_000);
            try (java.io.InputStream is = conn.getInputStream()) {
                return ImageIO.read(is);
            }
        } catch (IOException e) {
            log.warn("OgImageService no pudo leer imagen url={}: {}", url, e.getMessage());
            return null;
        }
    }

    private void dibujarTexto(Graphics2D g, String tituloRaw, String subtitulo) {
        int x = PADDING * 2 + FOTO_ANCHO;
        int anchoTexto = ANCHO - x - PADDING;
        int y = 200;
        // Título: SansSerif bold tamaño grande, dividido en hasta 3 líneas.
        Font tituloFont = new Font(Font.SANS_SERIF, Font.BOLD, 64);
        g.setFont(tituloFont);
        g.setColor(TEXTO_PRINCIPAL);
        for (String linea : envolver(g, tituloRaw, anchoTexto, 3)) {
            g.drawString(linea, x, y);
            y += 72;
        }
        // Subtítulo (anime/descripción): regular, color secundario.
        Font subFont = new Font(Font.SANS_SERIF, Font.PLAIN, 32);
        g.setFont(subFont);
        g.setColor(TEXTO_SECUNDARIO);
        y += 20;
        for (String linea : envolver(g, subtitulo, anchoTexto, 2)) {
            g.drawString(linea, x, y);
            y += 40;
        }
    }

    private void dibujarLogo(Graphics2D g) {
        Font logoFont = new Font(Font.SANS_SERIF, Font.BOLD, 28);
        g.setFont(logoFont);
        g.setColor(ACENTO);
        g.drawString("AnimeShowdown", PADDING * 2 + FOTO_ANCHO, ALTO - PADDING);
    }

    /**
     * Wrap básico de texto en líneas que quepan en el ancho dado. Si el
     * texto no entra ni con `maxLineas`, se trunca con "…".
     */
    private java.util.List<String> envolver(Graphics2D g, String texto, int maxAncho, int maxLineas) {
        java.util.List<String> lineas = new java.util.ArrayList<>();
        if (texto == null || texto.isBlank()) {
            return lineas;
        }
        String[] palabras = texto.split("\\s+");
        StringBuilder actual = new StringBuilder();
        var fm = g.getFontMetrics();
        for (String palabra : palabras) {
            String candidata = actual.length() == 0 ? palabra : actual + " " + palabra;
            if (fm.stringWidth(candidata) <= maxAncho) {
                actual.setLength(0);
                actual.append(candidata);
            } else {
                if (actual.length() > 0) {
                    lineas.add(actual.toString());
                    actual.setLength(0);
                    if (lineas.size() == maxLineas) break;
                }
                actual.append(palabra);
            }
        }
        if (actual.length() > 0 && lineas.size() < maxLineas) {
            lineas.add(actual.toString());
        }
        // Truncar la última línea con elipsis si quedó texto pendiente.
        if (lineas.size() == maxLineas && fm.stringWidth(lineas.get(maxLineas - 1)) > maxAncho - 30) {
            String ultima = lineas.get(maxLineas - 1);
            while (fm.stringWidth(ultima + "…") > maxAncho && ultima.length() > 1) {
                ultima = ultima.substring(0, ultima.length() - 1);
            }
            lineas.set(maxLineas - 1, ultima + "…");
        }
        return lineas;
    }

    private byte[] toPng(BufferedImage img) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream(150_000);
        ImageIO.write(img, "png", baos);
        return baos.toByteArray();
    }
}
