package com.diegoalegil.animeshowdown.service;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.databind.JsonNode;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;

/**
 * Cliente HTTP de la Jikan API (proxy de MyAnimeList) con resiliencia.
 *
 * Antes: RestClient sin timeout, sin retry, sin circuit breaker, sin caché.
 * Si Jikan caía o tardaba, este endpoint admin tiraba indefinidamente.
 *
 * Ahora:
 * - RestClient con connect timeout 3s + read timeout 5s (un fallo rápido en
 *   lugar de bloquear el thread pool de Tomcat).
 * - @Retry("jikan") aplica retry exponencial (500ms → 1s → 2s) con max 3
 *   intentos sobre IOException / 5xx / ResourceAccessException. Errores 4xx
 *   no se reintentan (404 no se va a arreglar reintentando).
 * - @CircuitBreaker("jikan") abre el circuito tras 50% de fallos en 10
 *   llamadas y queda abierto 30s antes de probar half-open. Mientras está
 *   abierto, lanza CallNotPermittedException inmediatamente sin tocar Jikan.
 * - @Cacheable("jikan-top-characters") guarda cada página 1h en Caffeine.
 *   Reimportar dentro de la ventana usa caché y no quema rate limit de Jikan.
 *
 * Configuración de los policies en application.properties bajo el prefijo
 * resilience4j.{retry,circuitbreaker,timelimiter}.instances.jikan.*
 */
@Service
public class JikanService {

    private static final Logger log = LoggerFactory.getLogger(JikanService.class);

    private static final String BASE_URL = "https://api.jikan.moe/v4";
    private static final int MAX_PAGES = 10;
    private static final long DELAY_BETWEEN_PAGES_MS = 400;

    private final RestClient restClient;
    private final PersonajeRepository personajeRepository;

    // Self-injection vía proxy. Sin esto la llamada this.fetchTopCharactersPage
    // desde importarTopPersonajes es invocación directa al método del bean
    // concreto → Spring AOP no aplica → @Cacheable/@Retry/@CircuitBreaker se
    // ignoran. Audit P2 (2026-05-17): la cabecera de fetchTopCharactersPage
    // afirmaba que "no funcionan si se llaman desde dentro de la misma clase"
    // pero el código de importarTopPersonajes hacía exactamente eso.
    @Autowired
    @Lazy
    private JikanService self;

    public JikanService(PersonajeRepository personajeRepository) {
        // RestClient con timeout explícito. Antes se construía con
        // RestClient.create(BASE_URL) y el factory por defecto no impone
        // timeout en absoluto.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(3).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(5).toMillis());

        this.restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .requestFactory(factory)
                .build();
        this.personajeRepository = personajeRepository;
    }

    /**
     * Importa los top N personajes de Jikan paginando hasta MAX_PAGES.
     * Sigue siendo el caller responsable de iterar; cada llamada a
     * fetchTopCharactersPage queda envuelta en cache+retry+circuitbreaker.
     */
    public List<Personaje> importarTopPersonajes(int cantidad) {
        List<Personaje> importados = new ArrayList<>();
        int page = 1;

        while (importados.size() < cantidad && page <= MAX_PAGES) {
            JsonNode response = self.fetchTopCharactersPage(page);

            if (response == null || !response.has("data")) {
                break;
            }
            JsonNode data = response.get("data");
            if (data.size() == 0) {
                break;
            }

            for (JsonNode character : data) {
                if (importados.size() >= cantidad) {
                    break;
                }

                String nombre = character.path("name").asText();
                if (nombre.isBlank() || personajeRepository.existsByNombre(nombre)) {
                    continue;
                }

                String anime = extraerPrimerAnime(character);
                String descripcion = truncar(character.path("about").asText(""), 497);
                String imagenUrl = character.path("images").path("jpg").path("image_url").asText("");

                // Audit P2 (2026-05-17): el constructor 4-arg dejaba slug=null,
                // y la columna slug es NOT NULL desde V1__initial_schema.sql.
                // Cualquier import explotaba con NOT NULL violation. Derivamos
                // un slug del nombre con slugify simple; si colisiona con un
                // personaje existente, lo saltamos (idempotente).
                String slug = slugify(nombre);
                if (slug.isBlank() || personajeRepository.findBySlug(slug).isPresent()) {
                    continue;
                }

                Personaje p = new Personaje(slug, nombre, anime, descripcion, imagenUrl);
                importados.add(personajeRepository.save(p));
            }

            page++;
            try {
                Thread.sleep(DELAY_BETWEEN_PAGES_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        return importados;
    }

    /**
     * Llamada cruda a /top/characters?page=N con resiliencia completa.
     * Separada como método público con anotaciones de cache + retry +
     * circuit-breaker. Spring AOP solo se aplica vía proxy; importar
     * desde dentro de la clase debe hacerse con self.fetchTopCharactersPage,
     * no this.fetchTopCharactersPage. Ver el campo {@code self} arriba.
     */
    @Cacheable(value = "jikan-top-characters", key = "#page")
    @Retry(name = "jikan")
    @CircuitBreaker(name = "jikan")
    public JsonNode fetchTopCharactersPage(int page) {
        log.debug("Jikan: fetch /top/characters?page={}", page);
        return restClient.get()
                .uri("/top/characters?page={page}", page)
                .retrieve()
                .body(JsonNode.class);
    }

    /**
     * Busca el mal_id de un personaje por nombre, filtrando por anime para
     * desambiguar homónimos comunes ("Lucy" existe en Pokemon, Elfen Lied y
     * Cyberpunk Edgerunners; "Yui" en Angel Beats y SAO; etc).
     *
     * <p>Estrategia:
     * <ol>
     *   <li>Trae hasta 10 candidatos por nombre.</li>
     *   <li>Recorre cada uno y mira sus animes asociados; si el título Jikan
     *       y el {@code anime} de nuestra BBDD se contienen mutuamente
     *       (case-insensitive), match exacto y devolvemos su mal_id.</li>
     *   <li>Si nadie matchea, devolvemos el primer candidato con mal_id
     *       válido como fallback — mejor que nada porque suele acertar para
     *       nombres únicos.</li>
     *   <li>Optional.empty si Jikan no devuelve nada o todos los candidatos
     *       carecen de mal_id.</li>
     * </ol>
     *
     * <p>Cacheable 30d implícito (TTL definido en application.properties
     * cache 'jikan-character-malid'); el mapeo nombre→mal_id es estable.
     */
    @Cacheable(value = "jikan-character-malid", key = "#nombre + '|' + #anime")
    @Retry(name = "jikan")
    @CircuitBreaker(name = "jikan", fallbackMethod = "searchMalIdFallback")
    public Optional<Integer> searchCharacterMalId(String nombre, String anime) {
        log.debug("Jikan: search /characters?q={}", nombre);
        JsonNode response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/characters")
                        .queryParam("q", nombre)
                        .queryParam("limit", 10)
                        .build())
                .retrieve()
                .body(JsonNode.class);
        if (response == null || !response.has("data")) {
            return Optional.empty();
        }
        JsonNode data = response.get("data");
        if (!data.isArray() || data.size() == 0) {
            return Optional.empty();
        }
        String animeLower = anime == null ? "" : anime.toLowerCase();
        Integer fallbackId = null;
        for (JsonNode character : data) {
            if (!character.path("mal_id").isInt()) continue;
            int malId = character.path("mal_id").asInt();
            JsonNode animes = character.path("anime");
            if (!animeLower.isBlank() && animes.isArray()) {
                for (JsonNode entry : animes) {
                    String titulo = entry.path("anime").path("title").asText("").toLowerCase();
                    if (!titulo.isBlank()
                            && (titulo.contains(animeLower) || animeLower.contains(titulo))) {
                        return Optional.of(malId);
                    }
                }
            }
            if (fallbackId == null) fallbackId = malId;
        }
        return Optional.ofNullable(fallbackId);
    }

    /**
     * Fallback del circuit breaker para searchCharacterMalId. Signature debe
     * matchear la del método original + Throwable; el binding lo hace
     * resilience4j por reflexión.
     */
    @SuppressWarnings("unused")
    public Optional<Integer> searchMalIdFallback(String nombre, String anime, Throwable t) {
        log.warn("Jikan search mal_id fallback (nombre={}, anime={}): {}", nombre, anime, t.getMessage());
        return Optional.empty();
    }

    /**
     * Trae las URLs de imágenes adicionales de un personaje desde
     * /characters/{mal_id}/pictures, filtra las que son blanco y negro
     * (paneles de manga, scans grises) y devuelve solo las en color
     * (frames del anime, key visuals).
     *
     * <p>El filtrado descarga cada imagen al primer hit por personaje y
     * samplea pixels (ver {@link #imageHasColor}); el resultado FILTRADO
     * se cachea 7d. La heurística de color tolera escenas oscuras o con
     * tints (azul nocturno, sepia) — solo descarta imágenes verdaderamente
     * grayscale.
     *
     * <p>Devuelve lista vacía si Jikan no responde, no hay data o todas
     * las entradas vienen sin URL.
     */
    @Cacheable(value = "jikan-character-pictures", key = "#malId")
    @Retry(name = "jikan")
    @CircuitBreaker(name = "jikan", fallbackMethod = "fetchPicturesFallback")
    public List<String> fetchCharacterPictures(int malId) {
        log.debug("Jikan: fetch /characters/{}/pictures", malId);
        JsonNode response = restClient.get()
                .uri("/characters/{id}/pictures", malId)
                .retrieve()
                .body(JsonNode.class);
        if (response == null || !response.has("data")) {
            return List.of();
        }
        JsonNode data = response.get("data");
        if (!data.isArray()) return List.of();
        List<String> urls = new ArrayList<>();
        for (JsonNode entry : data) {
            String url = entry.path("jpg").path("image_url").asText("");
            if (!url.isBlank()) urls.add(url);
        }
        // Filtrado B&W. Llamada vía self para que el @Cacheable per-URL
        // funcione (Spring AOP solo aplica via proxy). Si imageHasColor
        // lanza, asumimos color (no perdemos imágenes por fallos transitorios).
        List<String> soloColor = new ArrayList<>();
        for (String url : urls) {
            boolean keep = true;
            try {
                keep = self.imageHasColor(url);
            } catch (Exception e) {
                log.warn("No se pudo analizar color de {}: {} — la mantenemos", url, e.getMessage());
            }
            if (keep) soloColor.add(url);
        }
        return soloColor;
    }

    /**
     * Heurística de detección "blanco y negro" para una imagen accesible
     * por URL. Descarga la imagen, samplea {@value #COLOR_SAMPLES} pixels
     * aleatorios y cuenta los "grises" (delta R/G/B < {@value
     * #COLOR_DELTA_THRESHOLD}). Si más del {@value #COLOR_GRAY_RATIO_MAX
     * } * 100% son grises, la imagen es B&W → devuelve false.
     *
     * <p>Cacheable indefinido: la naturaleza color/B&W de una URL
     * concreta no cambia, así que un acierto evita la descarga otra vez.
     * Excepciones NO se cachean (Spring @Cacheable comportamiento
     * default), así que un fallo transitorio reintenta en próxima llamada.
     *
     * <p>Devuelve true si la imagen es color o si por alguna razón el
     * análisis no puede concluir (max RGB delta del sample fue 0 — imagen
     * sólida sin contenido útil, raro).
     */
    @Cacheable(value = "jikan-image-is-color", key = "#url")
    public boolean imageHasColor(String url) throws IOException {
        URL u = URI.create(url).toURL();
        URLConnection conn = u.openConnection();
        conn.setConnectTimeout(3000);
        conn.setReadTimeout(5000);
        // User-Agent realista — algunos CDNs rechazan default "Java/x.x.x".
        conn.setRequestProperty("User-Agent", "AnimeShowdown/1.0 (+https://animeshowdown.dev)");
        BufferedImage img;
        try (InputStream in = conn.getInputStream()) {
            img = ImageIO.read(in);
        }
        if (img == null) {
            // ImageIO no pudo decodificar (formato no soportado o stream vacío).
            // No bloqueamos la galería por eso.
            log.debug("ImageIO.read=null para {} — asumimos color", url);
            return true;
        }
        return analyzeHasColor(img);
    }

    private static final int COLOR_SAMPLES = 200;
    private static final int COLOR_DELTA_THRESHOLD = 18;
    private static final double COLOR_GRAY_RATIO_MAX = 0.75;

    /**
     * Sampler de pixels para el clasificador B&W. Separado del método con
     * @Cacheable para poder testear con BufferedImage in-memory sin red.
     */
    boolean analyzeHasColor(BufferedImage img) {
        int width = img.getWidth();
        int height = img.getHeight();
        if (width < 4 || height < 4) return true;
        int gris = 0;
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        for (int i = 0; i < COLOR_SAMPLES; i++) {
            int x = rnd.nextInt(width);
            int y = rnd.nextInt(height);
            int rgb = img.getRGB(x, y);
            int r = (rgb >> 16) & 0xFF;
            int g = (rgb >> 8) & 0xFF;
            int b = rgb & 0xFF;
            int max = Math.max(r, Math.max(g, b));
            int min = Math.min(r, Math.min(g, b));
            if (max - min < COLOR_DELTA_THRESHOLD) gris++;
        }
        double ratioGris = (double) gris / COLOR_SAMPLES;
        return ratioGris <= COLOR_GRAY_RATIO_MAX;
    }

    @SuppressWarnings("unused")
    public List<String> fetchPicturesFallback(int malId, Throwable t) {
        log.warn("Jikan pictures fallback (malId={}): {}", malId, t.getMessage());
        return List.of();
    }

    private String extraerPrimerAnime(JsonNode character) {
        JsonNode animes = character.path("anime");
        if (animes.isArray() && animes.size() > 0) {
            String titulo = animes.get(0).path("anime").path("title").asText("");
            if (!titulo.isBlank()) {
                return titulo;
            }
        }
        return "Desconocido";
    }

    private String truncar(String texto, int max) {
        if (texto == null) {
            return "";
        }
        if (texto.length() <= max) {
            return texto;
        }
        return texto.substring(0, max) + "...";
    }

    /** Slugify mínimo: NFD + strip diacríticos, lowercase, espacios/no-alnum → _. */
    private String slugify(String nombre) {
        if (nombre == null) return "";
        String norm = java.text.Normalizer.normalize(nombre, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        return norm;
    }
}
