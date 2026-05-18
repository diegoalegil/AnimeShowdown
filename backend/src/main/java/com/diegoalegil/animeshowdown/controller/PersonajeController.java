package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.DueloRecienteDto;
import com.diegoalegil.animeshowdown.dto.EloHistoryPoint;
import com.diegoalegil.animeshowdown.dto.MatchupResumenDto;
import com.diegoalegil.animeshowdown.dto.PersonajeActualizarRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeCrearRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeSimilarDto;
import com.diegoalegil.animeshowdown.dto.VotosPeriodoDto;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.service.EloHistoryService;
import com.diegoalegil.animeshowdown.service.JikanService;
import com.diegoalegil.animeshowdown.service.PersonajeMatchupService;
import com.diegoalegil.animeshowdown.service.RecomendacionService;
import com.diegoalegil.animeshowdown.service.VotosPeriodoService;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/personajes")
public class PersonajeController {

    private final PersonajeRepository personajeRepository;
    private final RecomendacionService recomendacionService;
    private final EloHistoryService eloHistoryService;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final PersonajeMatchupService personajeMatchupService;
    private final VotosPeriodoService votosPeriodoService;
    private final JikanService jikanService;

    public PersonajeController(PersonajeRepository personajeRepository,
            RecomendacionService recomendacionService,
            EloHistoryService eloHistoryService,
            EnfrentamientoRepository enfrentamientoRepository,
            PersonajeMatchupService personajeMatchupService,
            VotosPeriodoService votosPeriodoService,
            JikanService jikanService) {
        this.personajeRepository = personajeRepository;
        this.recomendacionService = recomendacionService;
        this.eloHistoryService = eloHistoryService;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.personajeMatchupService = personajeMatchupService;
        this.votosPeriodoService = votosPeriodoService;
        this.jikanService = jikanService;
    }

    /**
     * Plan v2 §2.10: cache 5min del listado. Key por filtro (anime), o 'all'
     * cuando no hay filtro. El catálogo es casi inmutable — las invalidaciones
     * vienen de crear/actualizar/eliminar/batch que hacen evict global.
     */
    @Cacheable(value = "personajes-listado", key = "#anime ?: 'all'")
    @GetMapping
    public List<Personaje> listarTodos(@RequestParam(required = false) String anime) {
        if (anime != null) {
            return personajeRepository.findByAnime(anime);
        }
        return personajeRepository.findAll();
    }

    /** Cache individual 5min por id — usado por /personajes/{id}. */
    @Cacheable(value = "personajes-individual", key = "#id")
    @GetMapping("/{id}")
    public Personaje buscarPorId(@PathVariable Long id) {
        return personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id));
    }

    /**
     * Crea un personaje desde un DTO validado. Antes aceptaba la entidad
     * Personaje directa sin @Valid, permitiendo slugs vacíos o caracteres
     * inválidos. Ahora PersonajeCrearRequest impone formato del slug,
     * longitudes y obligatoriedad de slug/nombre/anime.
     */
    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true)
    })
    @PostMapping
    public ResponseEntity<Personaje> crear(@Valid @RequestBody PersonajeCrearRequest request) {
        Personaje p = new Personaje(
                request.getSlug(),
                request.getNombre(),
                request.getAnime(),
                request.getDescripcion(),
                request.getImagenUrl());
        Personaje guardado = personajeRepository.save(p);
        return ResponseEntity.status(HttpStatus.CREATED).body(guardado);
    }

    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true)
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!personajeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        personajeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Actualización parcial: el cliente manda solo los campos a cambiar.
     * Los null se ignoran (preservan el valor previo). PersonajeActualizar
     * Request valida formato y tamaño pero no obliga a estar presentes.
     */
    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true)
    })
    @PutMapping("/{id}")
    public Personaje actualizar(
            @PathVariable Long id,
            @Valid @RequestBody PersonajeActualizarRequest datos) {
        Personaje p = personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id));
        if (datos.getSlug() != null) p.setSlug(datos.getSlug());
        if (datos.getNombre() != null) p.setNombre(datos.getNombre());
        if (datos.getAnime() != null) p.setAnime(datos.getAnime());
        if (datos.getDescripcion() != null) p.setDescripcion(datos.getDescripcion());
        if (datos.getImagenUrl() != null) p.setImagenUrl(datos.getImagenUrl());
        return personajeRepository.save(p);
    }

    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true)
    })
    @PostMapping("/batch")
    public List<Personaje> crearBatch(@RequestBody List<@Valid PersonajeCrearRequest> personajes) {
        return personajes.stream()
                .map(r -> personajeRepository.save(new Personaje(
                        r.getSlug(), r.getNombre(), r.getAnime(),
                        r.getDescripcion(), r.getImagenUrl())))
                .toList();
    }

    /**
     * Personajes similares al de un slug (Plan v2 §4.12). Discovery
     * cross-anime basado en proximidad de votos.
     *
     * <p>Endpoint público. limit clampa entre 1 y 24; default 8.
     */
    @GetMapping("/{slug}/similares")
    public List<PersonajeSimilarDto> similares(@PathVariable String slug,
            @RequestParam(defaultValue = "8") int limit) {
        return recomendacionService.similares(slug, limit);
    }

    /**
     * Time machine del ELO (Plan v2 §11.1) — serie temporal de votos
     * acumulados día a día. dias clampa entre 1 y 90; default 30.
     */
    @GetMapping("/{slug}/elo-history")
    public List<EloHistoryPoint> eloHistory(@PathVariable String slug,
            @RequestParam(defaultValue = "30") int dias) {
        return eloHistoryService.historial(slug, dias);
    }

    /**
     * Historial de duelos recientes del personaje (Plan producto 2026-05-18).
     *
     * <p>Devuelve los últimos N enfrentamientos donde participó (como
     * personaje1 o 2), incluyendo los aún sin ganador (resultado PENDING).
     * Sin auth — el historial es público igual que el ranking.
     *
     * <p>limit clampa entre 1 y 20.
     */
    @GetMapping("/{slug}/duelos-recientes")
    public ResponseEntity<List<DueloRecienteDto>> duelosRecientes(
            @PathVariable String slug,
            @RequestParam(defaultValue = "10") int limit) {
        var personajeOpt = personajeRepository.findBySlug(slug);
        if (personajeOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        var personaje = personajeOpt.get();
        int sane = Math.max(1, Math.min(20, limit));
        var pageable = org.springframework.data.domain.PageRequest.of(0, sane);
        var lista = enfrentamientoRepository
                .findHistorialPorPersonaje(personaje.getId(), pageable)
                .stream()
                .map(e -> DueloRecienteDto.from(e, personaje))
                .toList();
        return ResponseEntity.ok(lista);
    }

    /**
     * Actividad reciente de votos del personaje (Plan producto sprint
     * 2026-05-18 — actividad real por votos recientes).
     *
     * <p>Devuelve votos absolutos en la ventana actual + ventana
     * anterior + delta. Sin auth — son agregados públicos.
     * dias acotado [1, 90], 404 si slug no existe.
     */
    @GetMapping("/{slug}/votos-periodo")
    public ResponseEntity<VotosPeriodoDto> votosPeriodoSlug(
            @PathVariable String slug,
            @RequestParam(defaultValue = "7") int dias) {
        int saneDias = Math.max(1, Math.min(90, dias));
        try {
            return ResponseEntity.ok(votosPeriodoService.calcularSlug(slug, saneDias));
        } catch (EntityNotFoundException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Versión batch del endpoint anterior — evita N+1 cuando el frontend
     * necesita actividad para múltiples personajes a la vez (Pulso Movers,
     * FavoritosBanner). Una sola request → mapeo {slug → VotosPeriodoDto}.
     *
     * <p>slugs viene como CSV en query string ({@code ?slugs=luffy,naruto,zoro}).
     * Limit hard server-side de 50 slugs para evitar abuso y queries muy
     * grandes; si el caller manda más, se recortan los primeros 50.
     * Slugs inexistentes se omiten silenciosamente.
     */
    @GetMapping("/votos-periodo")
    public List<VotosPeriodoDto> votosPeriodoBatch(
            @RequestParam String slugs,
            @RequestParam(defaultValue = "7") int dias) {
        int saneDias = Math.max(1, Math.min(90, dias));
        List<String> lista = java.util.Arrays.stream(slugs.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .limit(50)
                .toList();
        return votosPeriodoService.calcularBatch(lista, saneDias);
    }

    /**
     * Resumen agregado "Contra quién" — mejores/peores/frecuentes
     * matchups (Plan producto 2026-05-18). Sin auth.
     *
     * <p>404 si el slug no existe; 200 con listas vacías y total=0 si
     * el personaje no tiene aún enfrentamientos decididos (el frontend
     * pinta empty state "Aún necesita más duelos").
     */
    @GetMapping("/{slug}/matchups")
    public ResponseEntity<MatchupResumenDto> matchups(@PathVariable String slug) {
        try {
            return ResponseEntity.ok(personajeMatchupService.calcular(slug));
        } catch (EntityNotFoundException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Galería de imágenes adicionales del personaje desde Jikan (Plan v2
     * §4.12 step 1 — multi-image oficial). Devuelve hasta 12 URLs de
     * /characters/{mal_id}/pictures. Lista vacía si:
     *   - Jikan no encuentra mal_id para el nombre+anime,
     *   - el personaje no tiene pictures registradas,
     *   - Jikan caído o circuit-breaker abierto.
     *
     * <p>404 solo si el slug no existe en nuestra BBDD. Las dos llamadas
     * a JikanService están cacheadas (mal_id 30d, pictures 7d), así que el
     * coste real es del primer hit por personaje.
     */
    @GetMapping("/{slug}/imagenes")
    public ResponseEntity<List<String>> imagenes(@PathVariable String slug) {
        var personajeOpt = personajeRepository.findBySlug(slug);
        if (personajeOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        var personaje = personajeOpt.get();
        var malIdOpt = jikanService.searchCharacterMalId(personaje.getNombre(), personaje.getAnime());
        if (malIdOpt.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<String> urls = jikanService.fetchCharacterPictures(malIdOpt.get()).stream()
                .limit(12)
                .toList();
        return ResponseEntity.ok(urls);
    }

    /**
     * Endpoint legacy de voto directo a personaje (sin enfrentamiento).
     * Deshabilitado (audit P2 2026-05-17): tras dropear el unique
     * uk_voto_personaje_usuario en V16, el check app-level
     * existsByPersonajeAndUsuario era vulnerable a doble voto bajo
     * concurrencia. El endpoint canónico vive en otro recurso (enfrentamiento,
     * no personaje), así que no hay redirect 1:1.
     *
     * <p>Audit P3 (2026-05-17, 4ª iter): quitado el header Link al
     * canónico — apuntaba a /api/enfrentamientos/&#123;id&#125;/votar con el
     * mismo id legacy (personajeId), pero el sucesor espera un
     * enfrentamientoId. Eran recursos distintos y el Link confundía a
     * clientes que lo siguieran ciegamente. El body explica el flow
     * nuevo en lugar de un Link engañoso.
     */
    @PostMapping("/{id}/votar")
    public ResponseEntity<?> votarLegacy(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.GONE)
                .body(Map.of(
                        "message",
                        "Endpoint retirado. Vota dentro de un enfrentamiento concreto: "
                                + "POST /api/enfrentamientos/{enfrentamientoId}/votar. "
                                + "Para obtener un enfrentamiento aleatorio activo: GET /api/enfrentamientos/aleatorio.",
                        "personajeIdRequested", id));
    }
}
