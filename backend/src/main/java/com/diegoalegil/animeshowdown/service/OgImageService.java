package com.diegoalegil.animeshowdown.service;

import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.SlugUtil;
import com.diegoalegil.animeshowdown.model.TierListItem;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.TierListRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import com.diegoalegil.animeshowdown.security.SsrfGuard;

/**
 * Render server-side de OG images (1200×630 PNG) para previews ricos en
 * Twitter/Discord/WhatsApp/Slack. 2.
 *
 * Diseño minimalista decidido en planning:
 *   - Fondo dark (#0d0d12) con gradiente carmesí sutil arriba-izquierda.
 *   - Foto del personaje a la izquierda, recorte 2:3 ocupando ~45% del ancho.
 *   - Texto a la derecha: nombre grande negrita + anime mediano + logo
 *     "AnimeShowdown" abajo en carmesí acento (oro para eyebrows/medallas).
 *
 * Cache 7 días vía Caffeine (CacheConfig). Como las imágenes pesan
 * ~150-300KB, 500 entradas son ~100MB max — dentro del presupuesto de
 * Railway. Para mover a CDN en futuro cuando una tarea programada.7 pida pre-cache.
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
    static final int REMOTE_IMAGE_MAX_BYTES = 2_000_000;
    static final long IMAGE_MAX_PIXELS = 4_000_000L;
    private static final int FOTO_ANCHO = 540;
    private static final int PADDING = 60;

    // Paleta de marca real: carmesí (#9f1d2c) + oro (#c5a15a) sobre fondo
    // casi-negro (#0d0d12). Antes el render usaba un magenta heredado
    // (#ff2e63) que ya no existe en el frontend; estas OG quedaban off-brand.
    private static final Color FONDO = new Color(13, 13, 18);
    private static final Color ACENTO = new Color(159, 29, 44);
    private static final Color ORO = new Color(197, 161, 90);
    private static final Color TEXTO_PRINCIPAL = new Color(245, 245, 250);
    private static final Color TEXTO_SECUNDARIO = new Color(160, 160, 175);

    /** Copia un color base con un alfa concreto (helper para fills translúcidos). */
    private static Color alpha(Color base, int a) {
        return new Color(base.getRed(), base.getGreen(), base.getBlue(), a);
    }

    private final PersonajeRepository personajeRepository;
    private final TorneoRepository torneoRepository;
    private final VotoRepository votoRepository;
    private final UsuarioRepository usuarioRepository;
    private final SeguidorRepository seguidorRepository;
    private final TierListRepository tierListRepository;
    private final String imagesBaseUrl;
    private final Cache<String, Boolean> imagenesFallidas = Caffeine.newBuilder()
            .maximumSize(2048)
            .expireAfterWrite(java.time.Duration.ofMinutes(10))
            .build();

    public OgImageService(
            PersonajeRepository personajeRepository,
            TorneoRepository torneoRepository,
            VotoRepository votoRepository,
            UsuarioRepository usuarioRepository,
            SeguidorRepository seguidorRepository,
            TierListRepository tierListRepository,
            @Value("${app.images.base-url}") String imagesBaseUrl) {
        this.personajeRepository = personajeRepository;
        this.torneoRepository = torneoRepository;
        this.votoRepository = votoRepository;
        this.usuarioRepository = usuarioRepository;
        this.seguidorRepository = seguidorRepository;
        this.tierListRepository = tierListRepository;
        this.imagesBaseUrl = imagesBaseUrl.endsWith("/")
                ? imagesBaseUrl.substring(0, imagesBaseUrl.length() - 1)
                : imagesBaseUrl;
    }

    /**
     * OG image para `/personajes/{slug}`. Cache key = slug; TTL 7 días.
     * Devuelve una imagen fallback si el personaje no existe o falla el render.
     */
    @Cacheable(value = "og-personaje", key = "#slug", unless = "#result == null")
    public byte[] renderPersonaje(String slug) {
        Personaje p = personajeRepository.findBySlug(slug).orElse(null);
        if (p == null) {
            return renderFallback("Personaje anime", "Duelo y ranking en AnimeShowdown");
        }
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
            return toPng(canvas);
        } catch (Exception e) {
            log.error("OgImageService.renderPersonaje fallo slug={}: {}", slug, e.getMessage(), e);
            return renderFallback(p.getNombre(), p.getAnime());
        }
    }

    /**
     * OG image para `/torneos/{slug}`. Comparte template con personaje pero
     * los textos vienen del torneo: nombre arriba, descripción abajo, foto
     * del ganador (si está FINISHED) o del primer participante (resto).
     */
    @Cacheable(value = "og-torneo", key = "#slug", unless = "#result == null")
    public byte[] renderTorneo(String slug) {
        Torneo t = torneoRepository.findBySlug(slug).orElse(null);
        if (t == null) {
            return renderFallback("Torneo anime", "Bracket visual en AnimeShowdown");
        }
        // torneos PENDIENTE/RECHAZADO no son públicos —
        // generar y servir su OG image filtraría nombre + descripción a
        // cualquier scraper de Open Graph (Twitter, Discord, Slack). Same
        // 404-equivalent que findBySlug/findById ya hacen.
        var rev = t.getEstadoRevision();
        if (rev == com.diegoalegil.animeshowdown.model.EstadoRevision.PENDIENTE
                || rev == com.diegoalegil.animeshowdown.model.EstadoRevision.RECHAZADO) {
            return renderFallback("Torneo anime", "Bracket visual en AnimeShowdown");
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
            return toPng(canvas);
        } catch (Exception e) {
            log.error("OgImageService.renderTorneo fallo slug={}: {}", slug, e.getMessage(), e);
            return renderFallback(t.getNombre(), "Torneo en AnimeShowdown");
        }
    }

    @Cacheable(value = "og-ranking", key = "'global'", unless = "#result == null")
    public byte[] renderRanking() {
        try {
            List<RankingOgEntry> top = votoRepository.rankingAllTime(PageRequest.of(0, 5))
                    .getContent()
                    .stream()
                    .map(RankingOgEntry::from)
                    .toList();
            if (top.isEmpty()) {
                top = personajeRepository.findAllOrderBySlug()
                        .stream()
                        .limit(5)
                        .map(RankingOgEntry::from)
                        .toList();
            }
            return renderRankingCard(
                    "Ranking competitivo",
                    "Top de personajes anime votados por la comunidad",
                    top,
                    "Vota y cambia la tabla");
        } catch (Exception e) {
            log.error("OgImageService.renderRanking fallo: {}", e.getMessage(), e);
            return renderFallback("Ranking competitivo", "Vota personajes anime en AnimeShowdown");
        }
    }

    /**
     * OG image de la portada (lo que se ve al compartir animeshowdown.dev).
     * Antes el OG del home era el logo plano (CTR bajo al compartir); aquí se
     * compone la misma tarjeta rica que el ranking pero con copy que vende el
     * sitio entero (top 5 personajes reales como gancho). Reusa el top all-time
     * con fallback al catálogo, igual que {@link #renderRanking()}.
     */
    @Cacheable(value = "og-home", key = "'home'", unless = "#result == null")
    public byte[] renderHome() {
        try {
            List<RankingOgEntry> top = votoRepository.rankingAllTime(PageRequest.of(0, 5))
                    .getContent()
                    .stream()
                    .map(RankingOgEntry::from)
                    .toList();
            if (top.isEmpty()) {
                top = personajeRepository.findAllOrderBySlug()
                        .stream()
                        .limit(5)
                        .map(RankingOgEntry::from)
                        .toList();
            }
            return renderRankingCard(
                    "Vota al mejor personaje de anime",
                    "Más de 1000 personajes · ranking ELO en directo · duelos y torneos",
                    top,
                    "Entra y mueve el ranking");
        } catch (Exception e) {
            log.error("OgImageService.renderHome fallo: {}", e.getMessage(), e);
            return renderFallback("AnimeShowdown", "Vota al mejor personaje de anime");
        }
    }

    @Cacheable(value = "og-anime", key = "#slug", unless = "#result == null")
    public byte[] renderAnime(String slug) {
        String targetSlug = SlugUtil.slugify(slug);
        String anime = personajeRepository.findDistinctAnimes()
                .stream()
                .filter(nombre -> SlugUtil.slugify(nombre).equals(targetSlug))
                .findFirst()
                .orElse(null);
        if (anime == null) {
            return renderFallback("Ranking de anime", "Top interno en AnimeShowdown");
        }
        try {
            List<RankingOgEntry> top = votoRepository.rankingPorAnime(anime, PageRequest.of(0, 5))
                    .stream()
                    .map(RankingOgEntry::from)
                    .toList();
            if (top.isEmpty()) {
                top = personajeRepository.findByAnime(anime)
                        .stream()
                        .sorted(Comparator.comparing(Personaje::getNombre, String.CASE_INSENSITIVE_ORDER))
                        .limit(5)
                        .map(RankingOgEntry::from)
                        .toList();
            }
            return renderRankingCard(
                    "Top de " + anime,
                    "Ranking interno de personajes en AnimeShowdown",
                    top,
                    "Entra a votar personajes de " + anime);
        } catch (Exception e) {
            log.error("OgImageService.renderAnime fallo slug={}: {}", slug, e.getMessage(), e);
            return renderFallback("Top de " + anime, "Ranking interno en AnimeShowdown");
        }
    }

    @Cacheable(value = "og-pvp", key = "'pvp-live'", unless = "#result == null")
    public byte[] renderPvp() {
        return renderFallback(
                "Duelo PvP en directo",
                "1v1 al mejor de 5 rondas · sube tu ELO PvP");
    }

    @Cacheable(value = "og-duelo", key = "#slugA + '-vs-' + #slugB", unless = "#result == null")
    public byte[] renderDuelo(String slugA, String slugB) {
        Personaje a = personajeRepository.findBySlug(slugA).orElse(null);
        Personaje b = personajeRepository.findBySlug(slugB).orElse(null);
        if (a == null || b == null || a.getSlug().equals(b.getSlug())) {
            return renderFallback("Duelo anime", "Compara personajes en AnimeShowdown");
        }
        try {
            BufferedImage canvas = nuevoLienzo();
            Graphics2D g = canvas.createGraphics();
            try {
                aplicarHints(g);
                dibujarFondo(g);
                dibujarFotoDuelo(g, a, PADDING, "壱");
                dibujarFotoDuelo(g, b, ANCHO - PADDING - 360, "弐");
                dibujarCentroDuelo(g, a, b);
                dibujarLogoCentrado(g);
            } finally {
                g.dispose();
            }
            return toPng(canvas);
        } catch (Exception e) {
            log.error("OgImageService.renderDuelo fallo slugA={} slugB={}: {}", slugA, slugB, e.getMessage(), e);
            return renderFallback(a.getNombre() + " vs " + b.getNombre(), "Duelo abierto en AnimeShowdown");
        }
    }

    @Cacheable(value = "og-tier-list", key = "#slug", unless = "#result == null")
    public byte[] renderTierList(String slug) {
        var tierList = tierListRepository.findBySlugAndPublicoTrue(slug).orElse(null);
        if (tierList == null) {
            return renderFallback("Tier list anime", "Crea y comparte tu ranking en AnimeShowdown");
        }
        try {
            List<RankingOgEntry> entries = tierList.getItems()
                    .stream()
                    .sorted(Comparator
                            .comparing((TierListItem item) -> item.getTier().ordinal())
                            .thenComparingInt(TierListItem::getPosicion)
                            .thenComparing(item -> item.getPersonaje().getNombre(), String.CASE_INSENSITIVE_ORDER))
                    .limit(5)
                    .map(item -> new RankingOgEntry(
                            item.getPersonaje().getNombre(),
                            "Tier " + item.getTier().name() + " · " + item.getPersonaje().getAnime(),
                            item.getPersonaje().getImagenUrl(),
                            0L))
                    .toList();
            return renderRankingCard(
                    tierList.getTitulo(),
                    "Tier list de @" + tierList.getUsuario().getUsername(),
                    entries,
                    "Haz tu propia tier list");
        } catch (Exception e) {
            log.error("OgImageService.renderTierList fallo slug={}: {}", slug, e.getMessage(), e);
            return renderFallback(tierList.getTitulo(), "Tier list en AnimeShowdown");
        }
    }

    /**
     * OG image para `/u/{username}` (B7 §1b). Avatar circular + username +
     * eyebrow oro "PERFIL" + dos stats (seguidores y votos emitidos).
     *
     * <p>Devuelve {@code null} si el usuario no existe —el controller lo
     * traduce a 404— en vez de un fallback genérico, para no anunciar
     * perfiles inexistentes a los crawlers. Cache key = username; TTL 7 días.
     */
    @Cacheable(value = "og-usuario", key = "#username", unless = "#result == null")
    public byte[] renderUsuario(String username) {
        Usuario u = usuarioRepository.findByUsername(username).orElse(null);
        if (u == null) {
            return null;
        }
        long seguidores = seguidorRepository.countByIdSeguidoId(u.getId());
        long votos = votoRepository.countByUsuario(u);
        try {
            BufferedImage canvas = nuevoLienzo();
            Graphics2D g = canvas.createGraphics();
            try {
                aplicarHints(g);
                dibujarFondoUsuario(g, u);
                dibujarAvatarCirculo(g, u.getAvatarUrl(), u.getUsername());
                dibujarTextoUsuario(g, u.getUsername(), seguidores, votos);
                dibujarLogo(g);
            } finally {
                g.dispose();
            }
            return toPng(canvas);
        } catch (Exception e) {
            log.error("OgImageService.renderUsuario fallo username={}: {}", username, e.getMessage(), e);
            return renderFallback("@" + u.getUsername(), "Perfil en AnimeShowdown");
        }
    }

    // === helpers de render ===

    private record RankingOgEntry(String nombre, String anime, String imagenUrl, long votos) {
        static RankingOgEntry from(RankingItem item) {
            Personaje p = item.getPersonaje();
            return new RankingOgEntry(
                    p.getNombre(),
                    p.getAnime(),
                    p.getImagenUrl(),
                    item.getVotos() == null ? 0L : Math.round(item.getVotos()));
        }

        static RankingOgEntry from(Personaje personaje) {
            return new RankingOgEntry(
                    personaje.getNombre(),
                    personaje.getAnime(),
                    personaje.getImagenUrl(),
                    0L);
        }
    }

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
                0, 0, alpha(ACENTO, 60),
                ANCHO * 0.6f, ALTO * 0.8f, alpha(FONDO, 0));
        g.setPaint(gradient);
        g.fillRect(0, 0, ANCHO, ALTO);
    }

    /**
     * Fondo del OG de perfil con el banner como cabecera/fondo (V35). Si el
     * usuario tiene banner lo usa; si no, cae al arte del personaje favorito
     * (regla de identidad: el banner nunca queda genérico). La imagen se dibuja
     * a sangre (cover, recorte centrado) con un overlay oscuro y un degradado
     * hacia la derecha para que el avatar y el texto encima sigan legibles. Si
     * no hay ninguna imagen disponible, cae al fondo de marca por defecto.
     */
    private void dibujarFondoUsuario(Graphics2D g, Usuario u) {
        g.setColor(FONDO);
        g.fillRect(0, 0, ANCHO, ALTO);

        String fuente = (u.getBannerUrl() != null && !u.getBannerUrl().isBlank())
                ? u.getBannerUrl()
                : favoritoImagenUrl(u);
        BufferedImage fondo = leerAvatar(fuente);
        if (fondo != null) {
            dibujarImagenCubriendo(g, fondo);
            // Velo oscuro uniforme para contraste del avatar/texto.
            g.setColor(alpha(FONDO, 175));
            g.fillRect(0, 0, ANCHO, ALTO);
            // Refuerzo a la derecha (zona de texto) hacia el fondo opaco.
            GradientPaint velo = new GradientPaint(
                    ANCHO * 0.35f, 0, alpha(FONDO, 0),
                    ANCHO, 0, alpha(FONDO, 205));
            g.setPaint(velo);
            g.fillRect(0, 0, ANCHO, ALTO);
        }

        // Acento carmesí de marca (igual que dibujarFondo) por encima del velo.
        GradientPaint gradient = new GradientPaint(
                0, 0, alpha(ACENTO, fondo != null ? 45 : 60),
                ANCHO * 0.6f, ALTO * 0.8f, alpha(FONDO, 0));
        g.setPaint(gradient);
        g.fillRect(0, 0, ANCHO, ALTO);
    }

    /**
     * imagenUrl del personaje favorito (más votado) del usuario, o null si aún
     * no ha votado. Sirve de fallback del banner. Defensivo ante fallos del
     * repo para no tumbar el render del OG.
     */
    private String favoritoImagenUrl(Usuario u) {
        try {
            List<TopPersonajeItem> top = votoRepository.topPorUsuario(u, PageRequest.of(0, 1));
            return top.isEmpty() ? null : top.get(0).imagenUrl();
        } catch (Exception e) {
            log.warn("OgImageService.favoritoImagenUrl fallo username={}: {}",
                    u.getUsername(), e.getMessage());
            return null;
        }
    }

    /** Dibuja la imagen a sangre sobre todo el lienzo (cover, recorte centrado). */
    private void dibujarImagenCubriendo(Graphics2D g, BufferedImage img) {
        int iw = img.getWidth();
        int ih = img.getHeight();
        if (iw <= 0 || ih <= 0) return;
        double escala = Math.max((double) ANCHO / iw, (double) ALTO / ih);
        int w = (int) Math.round(iw * escala);
        int h = (int) Math.round(ih * escala);
        g.drawImage(img, (ANCHO - w) / 2, (ALTO - h) / 2, w, h, null);
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

    private void dibujarFotoDuelo(Graphics2D g, Personaje personaje, int x, String kanji) {
        int y = 86;
        int ancho = 360;
        int alto = 430;

        g.setColor(alpha(ACENTO, 40));
        g.fillRoundRect(x, y, ancho, alto, 32, 32);
        g.setColor(new Color(255, 255, 255, 34));
        g.drawRoundRect(x, y, ancho, alto, 32, 32);

        boolean imagenDibujada = false;
        String imagenUrl = personaje.getImagenUrl();
        if (imagenUrl != null && !imagenUrl.isBlank()) {
            try {
                String url = imagenUrl.startsWith("http") ? imagenUrl : imagesBaseUrl + imagenUrl;
                BufferedImage foto = leerImagen(url);
                if (foto != null) {
                    Shape oldClip = g.getClip();
                    g.setClip(new RoundRectangle2D.Float(x, y, ancho, alto, 32, 32));
                    g.drawImage(foto, x, y, ancho, alto, null);
                    g.setClip(oldClip);
                    imagenDibujada = true;
                }
            } catch (Exception e) {
                log.warn("OgImageService.dibujarFotoDuelo fallo slug={}: {}", personaje.getSlug(), e.getMessage());
            }
        }

        if (!imagenDibujada) {
            Font kanjiFont = new Font(Font.SANS_SERIF, Font.BOLD, 118);
            g.setFont(kanjiFont);
            g.setColor(new Color(245, 245, 250, 44));
            g.drawString(kanji, x + 125, y + 245);
        }

        GradientPaint overlay = new GradientPaint(
                x, y + alto - 150, new Color(0, 0, 0, 0),
                x, y + alto, new Color(0, 0, 0, 215));
        g.setPaint(overlay);
        g.fillRoundRect(x, y + alto - 170, ancho, 170, 30, 30);

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 34));
        g.setColor(TEXTO_PRINCIPAL);
        g.drawString(truncar(g, personaje.getNombre(), ancho - 44), x + 22, y + alto - 70);

        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 22));
        g.setColor(TEXTO_SECUNDARIO);
        g.drawString(truncar(g, personaje.getAnime(), ancho - 44), x + 22, y + alto - 34);
    }

    private void dibujarCentroDuelo(Graphics2D g, Personaje a, Personaje b) {
        int centerX = ANCHO / 2;

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 24));
        g.setColor(ORO);
        dibujarTextoCentrado(g, "DUELO ABIERTO", centerX, 116);

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 92));
        g.setColor(TEXTO_PRINCIPAL);
        dibujarTextoCentrado(g, "VS", centerX, 282);

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 30));
        g.setColor(TEXTO_PRINCIPAL);
        dibujarTextoCentrado(g, "¿A quién subirías?", centerX, 350);

        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 22));
        g.setColor(TEXTO_SECUNDARIO);
        dibujarTextoCentrado(g, "Vota y cambia el ranking competitivo", centerX, 386);

        g.setColor(alpha(ORO, 120));
        g.drawLine(463, 315, 737, 315);

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 20));
        g.setColor(new Color(245, 245, 250, 190));
        dibujarTextoCentrado(g, truncar(g, a.getNombre() + " vs " + b.getNombre(), 420), centerX, 464);
    }

    private void dibujarLogoCentrado(Graphics2D g) {
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 26));
        g.setColor(ACENTO);
        dibujarTextoCentrado(g, "AnimeShowdown", ANCHO / 2, ALTO - 52);
    }

    private void dibujarTextoCentrado(Graphics2D g, String texto, int centerX, int y) {
        int width = g.getFontMetrics().stringWidth(texto);
        g.drawString(texto, centerX - width / 2, y);
    }

    private BufferedImage leerImagen(String url) {
        // ImageIO.read(URL) abre HttpURLConnection
        // por debajo SIN timeouts (conn ni read), así que una imagen
        // remota lenta o muerta dejaba el hilo del request OG bloqueado
        // indefinidamente. Esto es accesible por públicos sin auth (OG
        // crawlers de Twitter/Discord), por lo que un atacante podría
        // disparar OG de varios torneos con URLs externas lentas y
        // agotar el pool de Tomcat. Abrimos la conexión manualmente con
        // timeouts conservadores y leemos el stream con ImageIO.
        //
        // Anti-SSRF: el fetch lo dispara un endpoint OG público (permitAll),
        // así que un usuario podía fijar su avatar/banner a
        // http://169.254.169.254/... (metadata cloud) o http://127.0.0.1/...
        // y forzar al backend a pegarle. Solo se permiten http(s) y destinos
        // cuya IP REALMENTE resuelta es pública (ver SsrfGuard).
        String urlNormalizada = url == null ? "" : url.trim();
        if (imagenesFallidas.getIfPresent(urlNormalizada) != null) {
            return null;
        }
        if (!SsrfGuard.isFetchAllowed(urlNormalizada)) {
            registrarFalloImagen(urlNormalizada,
                    "destino interno/no permitido (SSRF)");
            return null;
        }
        try {
            URL u = URI.create(urlNormalizada).toURL();
            java.net.URLConnection conn = u.openConnection();
            conn.setConnectTimeout(3_000);
            conn.setReadTimeout(5_000);
            // Sin seguir redirects: un 30x a una IP interna evadiría el guard.
            if (conn instanceof java.net.HttpURLConnection httpConn) {
                httpConn.setInstanceFollowRedirects(false);
                int status = httpConn.getResponseCode();
                if (status < 200 || status >= 300) {
                    registrarFalloImagen(urlNormalizada, "status HTTP " + status);
                    return null;
                }
            }
            long contentLength = conn.getContentLengthLong();
            if (contentLength > REMOTE_IMAGE_MAX_BYTES) {
                registrarFalloImagen(urlNormalizada, "Content-Length excede presupuesto");
                return null;
            }
            String contentType = conn.getContentType();
            if (contentType != null && !contentType.isBlank()
                    && !contentType.toLowerCase(java.util.Locale.ROOT).startsWith("image/")) {
                registrarFalloImagen(urlNormalizada, "Content-Type no es imagen");
                return null;
            }
            try (java.io.InputStream is = conn.getInputStream()) {
                byte[] bytes = is.readNBytes(REMOTE_IMAGE_MAX_BYTES + 1);
                if (bytes.length > REMOTE_IMAGE_MAX_BYTES) {
                    registrarFalloImagen(urlNormalizada, "stream excede presupuesto");
                    return null;
                }
                BufferedImage imagen = decodificarImagenSegura(bytes);
                if (imagen == null) {
                    registrarFalloImagen(urlNormalizada, "decode rechazado");
                }
                return imagen;
            }
        } catch (IOException e) {
            registrarFalloImagen(urlNormalizada, e.getMessage());
            return null;
        }
    }

    private void registrarFalloImagen(String url, String motivo) {
        if (url == null || url.isBlank()) {
            return;
        }
        imagenesFallidas.put(url, Boolean.TRUE);
        log.warn("OgImageService no leera imagen url={} motivo={}", url, motivo);
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
     * Avatar circular del usuario en la zona izquierda, con halo carmesí y
     * anillo oro. Si no hay avatar (o falla la carga) pinta la inicial sobre
     * un círculo relleno.
     */
    private void dibujarAvatarCirculo(Graphics2D g, String avatarUrl, String username) {
        int d = 380;
        int cx = PADDING + FOTO_ANCHO / 2;
        int cy = ALTO / 2;
        int x = cx - d / 2;
        int y = cy - d / 2;

        g.setColor(alpha(ACENTO, 70));
        g.fillOval(x - 18, y - 18, d + 36, d + 36);

        BufferedImage avatar = leerAvatar(avatarUrl);
        if (avatar != null) {
            Shape oldClip = g.getClip();
            g.setClip(new Ellipse2D.Float(x, y, d, d));
            g.drawImage(avatar, x, y, d, d, null);
            g.setClip(oldClip);
        } else {
            g.setColor(alpha(ACENTO, 150));
            g.fillOval(x, y, d, d);
            String inicial = username == null || username.isBlank()
                    ? "?" : username.substring(0, 1).toUpperCase();
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 180));
            g.setColor(new Color(245, 245, 250, 220));
            int tw = g.getFontMetrics().stringWidth(inicial);
            g.drawString(inicial, cx - tw / 2, cy + 64);
        }

        g.setColor(ORO);
        g.setStroke(new BasicStroke(6f));
        g.drawOval(x, y, d, d);
    }

    private void dibujarTextoUsuario(Graphics2D g, String username, long seguidores, long votos) {
        int x = PADDING * 2 + FOTO_ANCHO;
        int anchoTexto = ANCHO - x - PADDING;
        int y = 210;

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 26));
        g.setColor(ORO);
        g.drawString("PERFIL", x, y);

        y += 70;
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 64));
        g.setColor(TEXTO_PRINCIPAL);
        // El username es un único token sin espacios (regex ^[A-Za-z0-9_-]+$),
        // así que envolver() nunca puede partirlo en 2 líneas: a 64px un nombre
        // largo (el límite es 30 chars) desbordaba el lienzo y lo recortaba el
        // borde sin elipsis. Se pinta en una sola línea, truncada con elipsis.
        g.drawString(truncar(g, "@" + username, anchoTexto), x, y);
        y += 72;

        y += 28;
        dibujarStatUsuario(g, x, y, formatearNumero(seguidores), "seguidores");
        dibujarStatUsuario(g, x + 260, y, formatearNumero(votos), "votos");
    }

    private void dibujarStatUsuario(Graphics2D g, int x, int y, String valor, String etiqueta) {
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 52));
        g.setColor(TEXTO_PRINCIPAL);
        g.drawString(valor, x, y);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 24));
        g.setColor(TEXTO_SECUNDARIO);
        g.drawString(etiqueta, x, y + 34);
    }

    /** Formato compacto (1234 → "1.2k") con punto decimal estable (Locale.ROOT). */
    private static String formatearNumero(long n) {
        if (n < 1000) return Long.toString(n);
        if (n < 1_000_000) {
            double k = n / 1000.0;
            return k == Math.floor(k)
                    ? String.format(java.util.Locale.ROOT, "%.0fk", k)
                    : String.format(java.util.Locale.ROOT, "%.1fk", k);
        }
        double m = n / 1_000_000.0;
        return m == Math.floor(m)
                ? String.format(java.util.Locale.ROOT, "%.0fM", m)
                : String.format(java.util.Locale.ROOT, "%.1fM", m);
    }

    /**
     * Carga el avatar del usuario. Soporta {@code data:} URIs (avatares
     * subidos en base64), URLs http(s) externas (OAuth / catálogo) y rutas
     * relativas a {@code app.images.base-url}. Devuelve null si falla.
     */
    private BufferedImage leerAvatar(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) return null;
        try {
            if (avatarUrl.startsWith("data:")) {
                int comma = avatarUrl.indexOf(',');
                if (comma < 0 || comma == avatarUrl.length() - 1) return null;
                String b64 = avatarUrl.substring(comma + 1).replaceAll("\\s", "");
                byte[] bytes = Base64.getDecoder().decode(b64);
                return decodificarImagenSegura(bytes);
            }
            String url = avatarUrl.startsWith("http") ? avatarUrl : imagesBaseUrl + avatarUrl;
            return leerImagen(url);
        } catch (Exception e) {
            log.warn("OgImageService.leerAvatar fallo: {}", e.getMessage());
            return null;
        }
    }

    static BufferedImage decodificarImagenSegura(byte[] bytes) throws IOException {
        if (bytes == null || bytes.length == 0 || bytes.length > REMOTE_IMAGE_MAX_BYTES) {
            return null;
        }
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (iis == null) {
                return null;
            }
            java.util.Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > IMAGE_MAX_PIXELS) {
                    return null;
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        }
    }

    private byte[] renderRankingCard(String titulo, String subtitulo, List<RankingOgEntry> top, String footer) {
        try {
            BufferedImage canvas = nuevoLienzo();
            Graphics2D g = canvas.createGraphics();
            try {
                aplicarHints(g);
                dibujarFondo(g);
                if (!top.isEmpty()) {
                    dibujarFoto(g, top.get(0).imagenUrl());
                }
                if (top.isEmpty()) {
                    dibujarPanelFallback(g, "頂");
                }
                dibujarRankingTexto(g, titulo, subtitulo, top, footer);
                dibujarLogo(g);
            } finally {
                g.dispose();
            }
            return toPng(canvas);
        } catch (Exception e) {
            log.error("OgImageService.renderRankingCard fallo: {}", e.getMessage(), e);
            return renderFallback(titulo, subtitulo);
        }
    }

    private void dibujarRankingTexto(Graphics2D g, String titulo, String subtitulo, List<RankingOgEntry> top, String footer) {
        int x = PADDING * 2 + FOTO_ANCHO;
        int anchoTexto = ANCHO - x - PADDING;
        int y = 100;

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 24));
        g.setColor(ACENTO);
        g.drawString("ANIMESHOWDOWN", x, y);

        y += 56;
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 54));
        g.setColor(TEXTO_PRINCIPAL);
        for (String linea : envolver(g, titulo, anchoTexto, 2)) {
            g.drawString(linea, x, y);
            y += 60;
        }

        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 26));
        g.setColor(TEXTO_SECUNDARIO);
        y += 6;
        for (String linea : envolver(g, subtitulo, anchoTexto, 2)) {
            g.drawString(linea, x, y);
            y += 34;
        }

        y += 18;
        int rank = 1;
        for (RankingOgEntry entry : top.stream().limit(5).toList()) {
            dibujarFilaRanking(g, x, y, anchoTexto, rank, entry);
            y += 54;
            rank++;
        }

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 22));
        g.setColor(new Color(245, 245, 250, 190));
        g.drawString(footer, x, ALTO - 105);
    }

    private void dibujarFilaRanking(Graphics2D g, int x, int y, int anchoTexto, int rank, RankingOgEntry entry) {
        g.setColor(rank == 1 ? alpha(ORO, 120) : alpha(ACENTO, 48));
        g.fillRoundRect(x, y - 31, 46, 40, 14, 14);

        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 20));
        g.setColor(TEXTO_PRINCIPAL);
        g.drawString("#" + rank, x + 10, y - 6);

        int textoX = x + 62;
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 24));
        g.setColor(TEXTO_PRINCIPAL);
        String nombre = truncar(g, entry.nombre(), anchoTexto - 62);
        g.drawString(nombre, textoX, y - 12);

        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 18));
        g.setColor(TEXTO_SECUNDARIO);
        String votos = entry.votos() > 0 ? entry.votos() + " votos" : "listo para votar";
        g.drawString(truncar(g, entry.anime() + " · " + votos, anchoTexto - 62), textoX, y + 14);
    }

    private String truncar(Graphics2D g, String texto, int maxAncho) {
        if (texto == null) return "";
        var fm = g.getFontMetrics();
        if (fm.stringWidth(texto) <= maxAncho) return texto;
        String out = texto;
        while (out.length() > 1 && fm.stringWidth(out + "…") > maxAncho) {
            out = out.substring(0, out.length() - 1);
        }
        return out + "…";
    }

    private byte[] renderFallback(String titulo, String subtitulo) {
        try {
            BufferedImage canvas = nuevoLienzo();
            Graphics2D g = canvas.createGraphics();
            try {
                aplicarHints(g);
                dibujarFondo(g);
                dibujarPanelFallback(g, "勝");
                dibujarTexto(g, titulo, subtitulo);
                dibujarLogo(g);
            } finally {
                g.dispose();
            }
            return toPng(canvas);
        } catch (Exception e) {
            log.error("OgImageService.renderFallback fallo: {}", e.getMessage(), e);
            return new byte[0];
        }
    }

    private void dibujarPanelFallback(Graphics2D g, String kanji) {
        g.setColor(alpha(ACENTO, 42));
        g.fillRoundRect(PADDING, PADDING, FOTO_ANCHO, ALTO - PADDING * 2, 36, 36);
        g.setColor(new Color(255, 255, 255, 28));
        g.drawRoundRect(PADDING, PADDING, FOTO_ANCHO, ALTO - PADDING * 2, 36, 36);
        Font kanjiFont = new Font(Font.SANS_SERIF, Font.BOLD, 132);
        g.setFont(kanjiFont);
        g.setColor(new Color(245, 245, 250, 42));
        g.drawString(kanji, PADDING + 170, PADDING + 280);
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
