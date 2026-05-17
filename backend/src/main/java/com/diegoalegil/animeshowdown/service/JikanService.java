package com.diegoalegil.animeshowdown.service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

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
