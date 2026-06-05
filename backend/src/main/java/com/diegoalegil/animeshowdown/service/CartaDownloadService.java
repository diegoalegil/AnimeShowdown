package com.diegoalegil.animeshowdown.service;

import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.util.Base64;
import java.util.Map;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import com.diegoalegil.animeshowdown.security.SsrfGuard;

import jakarta.servlet.http.HttpServletRequest;

@Service
public class CartaDownloadService {

    private static final Logger log = LoggerFactory.getLogger(CartaDownloadService.class);

    static final int ANCHO = 1024;
    static final int ALTO = 1536;
    private static final int MARGEN = 58;
    private static final Color FONDO = new Color(13, 13, 18);
    private static final Color ACENTO = new Color(159, 29, 44);
    private static final Color ORO = new Color(197, 161, 90);
    private static final Color TEXTO = new Color(245, 245, 250);
    private static final Color TEXTO_MUTED = new Color(176, 176, 190);

    private final CartaRepository cartaRepository;
    private final UsuarioCartaRepository usuarioCartaRepository;
    private final VotoRepository votoRepository;
    private final AuditLogService auditLogService;
    private final String imagesBaseUrl;
    private final String frontendBaseUrl;

    public CartaDownloadService(
            CartaRepository cartaRepository,
            UsuarioCartaRepository usuarioCartaRepository,
            VotoRepository votoRepository,
            AuditLogService auditLogService,
            @Value("${app.images.base-url}") String imagesBaseUrl,
            @Value("${app.frontend-base-url}") String frontendBaseUrl) {
        this.cartaRepository = cartaRepository;
        this.usuarioCartaRepository = usuarioCartaRepository;
        this.votoRepository = votoRepository;
        this.auditLogService = auditLogService;
        this.imagesBaseUrl = sinBarraFinal(imagesBaseUrl);
        // El arte ESPECIAL (webp ya compuesto) vive en /assets del CDN del
        // frontend, no en el CDN de imágenes; se resuelve contra este host.
        this.frontendBaseUrl = sinBarraFinal(frontendBaseUrl);
    }

    private static String sinBarraFinal(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    @Transactional(readOnly = true)
    public DescargaCarta descargar(Usuario usuario, Long cartaId, HttpServletRequest request) {
        Carta carta = cartaRepository.findById(cartaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carta no encontrada"));
        if (!usuarioCartaRepository.existsByUsuarioIdAndCartaId(usuario.getId(), carta.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No posees esta carta");
        }

        byte[] png = renderCarta(carta);
        Personaje p = carta.getPersonaje();
        auditLogService.registrar(
                AuditEvento.CARTA_DESCARGADA,
                usuario,
                Map.of(
                        "cartaId", carta.getId(),
                        "personajeSlug", p.getSlug(),
                        "rareza", carta.getRareza().name()),
                request);
        return new DescargaCarta(png, "carta-" + slugArchivo(p.getSlug()) + ".png");
    }

    private byte[] renderCarta(Carta carta) {
        try {
            BufferedImage canvas = new BufferedImage(ANCHO, ALTO, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = canvas.createGraphics();
            try {
                aplicarHints(g);
                BufferedImage arteEspecial = leerArteEspecial(carta);
                if (arteEspecial != null) {
                    // La carta ESPECIAL ya viene compuesta (arte + marco + nombre +
                    // ELO horneados): se pinta a sangre y solo se añade el watermark.
                    dibujarCover(g, arteEspecial, 0, 0, ANCHO, ALTO);
                    dibujarWatermark(g);
                } else {
                    dibujarFondo(g, carta.getPersonaje());
                    dibujarArte(g, carta.getPersonaje());
                    dibujarMarco(g, carta);
                    dibujarTexto(g, carta);
                    dibujarWatermark(g);
                }
            } finally {
                g.dispose();
            }
            return toPng(canvas);
        } catch (Exception e) {
            log.error("CartaDownloadService.renderCarta fallo cartaId={}: {}", carta.getId(), e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo componer la carta");
        }
    }

    private void aplicarHints(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    }

    private void dibujarFondo(Graphics2D g, Personaje personaje) {
        g.setColor(FONDO);
        g.fillRect(0, 0, ANCHO, ALTO);
        Color aura = parseColor(personaje.getImagenColorDominante(), ACENTO);
        GradientPaint gp = new GradientPaint(
                0, 0, alpha(aura, 95),
                ANCHO, ALTO, alpha(FONDO, 0));
        g.setPaint(gp);
        g.fillRect(0, 0, ANCHO, ALTO);
    }

    private void dibujarArte(Graphics2D g, Personaje personaje) {
        int x = MARGEN;
        int y = MARGEN;
        int w = ANCHO - MARGEN * 2;
        int h = 1128;
        Shape oldClip = g.getClip();
        g.setClip(new RoundRectangle2D.Float(x, y, w, h, 52, 52));
        BufferedImage arte = leerArte(personaje.getImagenUrl());
        if (arte != null) {
            dibujarCover(g, arte, x, y, w, h);
        } else {
            g.setColor(alpha(ACENTO, 92));
            g.fillRect(x, y, w, h);
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 150));
            g.setColor(new Color(245, 245, 250, 54));
            g.drawString("勝", x + 340, y + 560);
        }
        g.setClip(oldClip);

        GradientPaint shadow = new GradientPaint(
                x, y + h - 280, new Color(0, 0, 0, 0),
                x, y + h, new Color(0, 0, 0, 230));
        g.setPaint(shadow);
        g.fillRoundRect(x, y + h - 300, w, 300, 50, 50);
    }

    private void dibujarMarco(Graphics2D g, Carta carta) {
        int x = MARGEN - 8;
        int y = MARGEN - 8;
        int w = ANCHO - (MARGEN - 8) * 2;
        int h = ALTO - (MARGEN - 8) * 2;
        Color borde = carta.isEspecialCurada() ? new Color(242, 211, 128) : ORO;
        g.setStroke(new BasicStroke(8f));
        g.setColor(alpha(borde, 220));
        g.drawRoundRect(x, y, w, h, 62, 62);
        g.setStroke(new BasicStroke(2f));
        g.setColor(new Color(255, 255, 255, 46));
        g.drawRoundRect(x + 16, y + 16, w - 32, h - 32, 44, 44);
    }

    private void dibujarTexto(Graphics2D g, Carta carta) {
        Personaje p = carta.getPersonaje();
        int x = MARGEN + 28;
        int y = 1220;
        int ancho = ANCHO - (MARGEN + 28) * 2;

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 30));
        g.setColor(ORO);
        g.drawString(carta.getRareza().name(), x, y);

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 66));
        g.setColor(TEXTO);
        g.drawString(truncar(g, p.getNombre(), ancho), x, y + 78);

        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 34));
        g.setColor(TEXTO_MUTED);
        g.drawString(truncar(g, p.getAnime(), ancho), x, y + 124);

        int elo = eloBase(p);
        String label = "ELO " + elo;
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 32));
        int labelW = g.getFontMetrics().stringWidth(label);
        int badgeX = ANCHO - MARGEN - 42 - labelW;
        int badgeY = y - 28;
        g.setColor(new Color(0, 0, 0, 120));
        g.fillRoundRect(badgeX - 20, badgeY, labelW + 40, 52, 22, 22);
        g.setColor(ORO);
        g.drawString(label, badgeX, badgeY + 37);
    }

    private int eloBase(Personaje personaje) {
        Double pesoVotos = votoRepository.sumaPesoByPersonajeId(personaje.getId());
        double peso = Math.max(0.0, pesoVotos == null ? 0.0 : pesoVotos);
        return 1500 + (int) Math.min(999, Math.round(peso * 12));
    }

    private void dibujarWatermark(Graphics2D g) {
        String wordmark = "animeshowdown";
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 34));
        int width = g.getFontMetrics().stringWidth(wordmark);
        int x = (ANCHO - width) / 2;
        int y = ALTO - 54;
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.22f));
        g.setColor(new Color(245, 245, 250));
        g.drawString(wordmark, x, y);
        g.setComposite(AlphaComposite.SrcOver);
    }

    /**
     * Arte de la carta ESPECIAL (webp ya compuesto) leído del CDN del frontend, o
     * null si no es especial / no tiene arte / no se pudo leer (entonces el render
     * cae a la composición normal: degradación segura).
     */
    private BufferedImage leerArteEspecial(Carta carta) {
        if (carta.getRareza() != RarezaCarta.ESPECIAL) {
            return null;
        }
        String arteUrl = carta.getArteUrl();
        if (arteUrl == null || arteUrl.isBlank()) {
            return null;
        }
        String url = arteUrl.startsWith("http") ? arteUrl : frontendBaseUrl + arteUrl;
        return leerArte(url);
    }

    private BufferedImage leerArte(String imagenUrl) {
        if (imagenUrl == null || imagenUrl.isBlank()) return null;
        try {
            if (imagenUrl.startsWith("data:")) {
                int comma = imagenUrl.indexOf(',');
                if (comma < 0 || comma == imagenUrl.length() - 1) return null;
                byte[] bytes = Base64.getDecoder()
                        .decode(imagenUrl.substring(comma + 1).replaceAll("\\s", ""));
                return ImageIO.read(new ByteArrayInputStream(bytes));
            }
            String url = imagenUrl.startsWith("http") ? imagenUrl : imagesBaseUrl + imagenUrl;
            if (!SsrfGuard.isFetchAllowed(url)) {
                log.warn("CartaDownloadService bloqueó fetch a destino interno/no permitido: {}", url);
                return null;
            }
            URL u = URI.create(url).toURL();
            java.net.URLConnection conn = u.openConnection();
            if (conn instanceof java.net.HttpURLConnection httpConn) {
                httpConn.setInstanceFollowRedirects(false);
            }
            conn.setConnectTimeout(3_000);
            conn.setReadTimeout(5_000);
            try (java.io.InputStream is = conn.getInputStream()) {
                return ImageIO.read(is);
            }
        } catch (Exception e) {
            log.warn("CartaDownloadService no pudo leer arte url={}: {}", imagenUrl, e.getMessage());
            return null;
        }
    }

    private void dibujarCover(Graphics2D g, BufferedImage img, int x, int y, int w, int h) {
        int iw = img.getWidth();
        int ih = img.getHeight();
        if (iw <= 0 || ih <= 0) return;
        double escala = Math.max((double) w / iw, (double) h / ih);
        int dw = (int) Math.round(iw * escala);
        int dh = (int) Math.round(ih * escala);
        g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, null);
    }

    private String truncar(Graphics2D g, String texto, int maxAncho) {
        if (texto == null) return "";
        if (g.getFontMetrics().stringWidth(texto) <= maxAncho) return texto;
        String out = texto;
        while (out.length() > 1 && g.getFontMetrics().stringWidth(out + "…") > maxAncho) {
            out = out.substring(0, out.length() - 1);
        }
        return out + "…";
    }

    private static Color parseColor(String value, Color fallback) {
        if (value == null || value.isBlank()) return fallback;
        String clean = value.startsWith("#") ? value.substring(1) : value;
        if (clean.length() != 6) return fallback;
        try {
            return new Color(
                    Integer.parseInt(clean.substring(0, 2), 16),
                    Integer.parseInt(clean.substring(2, 4), 16),
                    Integer.parseInt(clean.substring(4, 6), 16));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static Color alpha(Color base, int a) {
        return new Color(base.getRed(), base.getGreen(), base.getBlue(), a);
    }

    private static String slugArchivo(String value) {
        if (value == null || value.isBlank()) return "carta";
        return value.toLowerCase().replaceAll("[^a-z0-9_-]+", "-").replaceAll("^-+|-+$", "");
    }

    private byte[] toPng(BufferedImage img) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream(320_000);
        ImageIO.write(img, "png", baos);
        return baos.toByteArray();
    }

    public record DescargaCarta(byte[] png, String filename) {
    }
}
