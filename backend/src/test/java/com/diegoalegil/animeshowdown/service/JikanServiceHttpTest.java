package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

/**
 * Cubre las llamadas RestClient de {@link JikanService} contra un servidor HTTP
 * local (JDK {@code com.sun.net.httpserver}, sin dependencias nuevas): parseo de
 * /top/characters, la desambiguación por anime de /characters y el bucle de
 * importación. La heurística de color y la normalización de URL ya las cubre
 * {@code JikanColorFilterTest}.
 *
 * <p>Al instanciar el service a mano (sin contexto Spring) las anotaciones
 * @Cacheable/@Retry/@CircuitBreaker NO se aplican (no hay proxy), así que cada
 * test ejercita la lógica cruda contra el mock.
 */
class JikanServiceHttpTest {

    private static final String TOP_JSON = """
            { "data": [
              { "name": "Test One", "about": "uno", "images": {"jpg":{"image_url":"http://img/1.jpg"}},
                "anime": [ {"anime":{"title":"Anime A"}} ] },
              { "name": "Test Two", "about": "dos", "images": {"jpg":{"image_url":"http://img/2.jpg"}},
                "anime": [ {"anime":{"title":"Anime B"}} ] }
            ] }
            """;

    // "Lucy" homónima: una en Pokemon (mal_id 100), otra en Elfen Lied (200).
    private static final String SEARCH_JSON = """
            { "data": [
              { "mal_id": 100, "anime": [ {"anime":{"title":"Pokemon"}} ] },
              { "mal_id": 200, "anime": [ {"anime":{"title":"Elfen Lied"}} ] }
            ] }
            """;

    private static final String EMPTY_JSON = "{ \"data\": [] }";

    private HttpServer server;
    private PersonajeRepository personajeRepository;
    private JikanService jikan;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/top/characters", ex -> {
            // Solo la página 1 trae data; el resto vacío para que el bucle de
            // importación termine de forma natural (el repo mockeado no persiste,
            // así que no podemos depender del dedup por slug entre páginas).
            String query = ex.getRequestURI().getQuery();
            boolean page1 = query == null || query.contains("page=1");
            respond(ex, page1 ? TOP_JSON : EMPTY_JSON);
        });
        server.createContext("/characters", ex -> {
            String query = ex.getRequestURI().getQuery();
            respond(ex, query != null && query.contains("q=Empty") ? EMPTY_JSON : SEARCH_JSON);
        });
        server.start();

        personajeRepository = mock(PersonajeRepository.class);
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        jikan = new JikanService(personajeRepository, baseUrl);
        // self-injection (proxy en prod); en el test apunta a la propia instancia.
        ReflectionTestUtils.setField(jikan, "self", jikan);
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void fetchTopCharactersPageParseaLaData() {
        JsonNode page = jikan.fetchTopCharactersPage(1);

        assertThat(page).isNotNull();
        assertThat(page.get("data")).hasSize(2);
        assertThat(page.get("data").get(0).path("name").asText()).isEqualTo("Test One");
    }

    @Test
    void searchCharacterMalIdDesambiguaPorAnime() {
        // El anime coincide con el segundo candidato → su mal_id, no el primero.
        assertThat(jikan.searchCharacterMalId("Lucy", "Elfen Lied")).contains(200);
    }

    @Test
    void searchCharacterMalIdCaeAlPrimerCandidatoSiNingunAnimeCoincide() {
        assertThat(jikan.searchCharacterMalId("Lucy", "Anime Inexistente")).contains(100);
    }

    @Test
    void searchCharacterMalIdVacioSiJikanNoDevuelveCandidatos() {
        assertThat(jikan.searchCharacterMalId("Empty", "Lo Que Sea")).isEmpty();
    }

    @Test
    void importarTopPersonajesGuardaLosNuevos() {
        when(personajeRepository.existsByNombre(anyString())).thenReturn(false);
        when(personajeRepository.findBySlug(anyString())).thenReturn(Optional.empty());
        when(personajeRepository.save(any(Personaje.class))).thenAnswer(inv -> inv.getArgument(0));

        var importados = jikan.importarTopPersonajes(2);

        assertThat(importados).hasSize(2);
        assertThat(importados).extracting(Personaje::getNombre)
                .containsExactly("Test One", "Test Two");
        verify(personajeRepository, times(2)).save(any(Personaje.class));
    }

    @Test
    void importarTopPersonajesSaltaLosQueYaExistenPorNombre() {
        when(personajeRepository.existsByNombre("Test One")).thenReturn(true);
        when(personajeRepository.existsByNombre("Test Two")).thenReturn(false);
        when(personajeRepository.findBySlug(anyString())).thenReturn(Optional.empty());
        when(personajeRepository.save(any(Personaje.class))).thenAnswer(inv -> inv.getArgument(0));

        var importados = jikan.importarTopPersonajes(5);

        assertThat(importados).extracting(Personaje::getNombre).containsExactly("Test Two");
        verify(personajeRepository, times(1)).save(any(Personaje.class));
    }

    private static void respond(HttpExchange ex, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }
}
