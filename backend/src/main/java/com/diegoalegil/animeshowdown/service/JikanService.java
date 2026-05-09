package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.fasterxml.jackson.databind.JsonNode;

@Service
public class JikanService {

    private static final String BASE_URL = "https://api.jikan.moe/v4";
    private static final int MAX_PAGES = 10;
    private static final long DELAY_BETWEEN_PAGES_MS = 400;

    private final RestClient restClient;
    private final PersonajeRepository personajeRepository;

    public JikanService(PersonajeRepository personajeRepository) {
        this.restClient = RestClient.create(BASE_URL);
        this.personajeRepository = personajeRepository;
    }

    public List<Personaje> importarTopPersonajes(int cantidad) {
        List<Personaje> importados = new ArrayList<>();
        int page = 1;

        while (importados.size() < cantidad && page <= MAX_PAGES) {
            JsonNode response = restClient.get()
                    .uri("/top/characters?page={page}", page)
                    .retrieve()
                    .body(JsonNode.class);

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

                Personaje p = new Personaje(nombre, anime, descripcion, imagenUrl);
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
}
