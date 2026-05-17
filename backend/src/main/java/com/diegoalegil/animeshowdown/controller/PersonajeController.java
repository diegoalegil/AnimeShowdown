package com.diegoalegil.animeshowdown.controller;

import java.util.List;

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

import com.diegoalegil.animeshowdown.dto.EloHistoryPoint;
import com.diegoalegil.animeshowdown.dto.PersonajeActualizarRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeCrearRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeSimilarDto;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import com.diegoalegil.animeshowdown.service.EloHistoryService;
import com.diegoalegil.animeshowdown.service.RecomendacionService;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/personajes")
public class PersonajeController {

    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;
    private final RecomendacionService recomendacionService;
    private final EloHistoryService eloHistoryService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public PersonajeController(PersonajeRepository personajeRepository,
            VotoRepository votoRepository,
            RecomendacionService recomendacionService,
            EloHistoryService eloHistoryService,
            org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
        this.recomendacionService = recomendacionService;
        this.eloHistoryService = eloHistoryService;
        this.eventPublisher = eventPublisher;
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
     * Endpoint legacy de voto directo a personaje (sin enfrentamiento).
     * El frontend usa {@code /api/enfrentamientos/{id}/votar} desde el
     * Bloque 1; este se mantiene por compatibilidad pero queda con las
     * mismas garantías de seguridad (audit P2.5 2026-05-17):
     *   - Requiere email verificado.
     *   - Cuenta para rate limit (RateLimitFilter incluye el path).
     *   - Idempotente: 409 si el usuario ya votó al personaje.
     */
    // Audit P3 (2026-05-17): @Transactional ahora obligatorio. Antes el save
    // corría en auto-commit y el publishEvent quedaba fuera de tx → el
    // BadgeEventListener (AFTER_COMMIT) descartaba el evento → este endpoint
    // legacy no desbloqueaba primer_voto/cien_votos/mil_votos. Mismo patrón
    // que /api/enfrentamientos/{id}/votar (audit P1 ronda anterior).
    @PostMapping("/{id}/votar")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> votar(@PathVariable Long id, @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!usuario.estaVerificado()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Necesitas verificar tu email antes de votar.");
        }
        Personaje personaje = personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id));

        if (votoRepository.existsByPersonajeAndUsuario(personaje, usuario)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Ya has votado a este personaje");
        }

        Voto voto = new Voto(personaje, usuario);
        // El check existsByPersonajeAndUsuario es app-level y vulnerable a
        // race condition (V16 dropeó uk_voto_personaje_usuario porque
        // bloqueaba el bracket legítimo). Defensivo: capturamos la posible
        // violación si la migración se restaurase parcialmente; hoy esto es
        // pasivo y permite dobles en concurrencia. Aceptable en este endpoint
        // legacy que la UI nueva no usa; el voto canónico es por enfrentamiento.
        Voto guardado;
        try {
            guardado = votoRepository.save(voto);
        } catch (org.springframework.dao.DataIntegrityViolationException dup) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Ya has votado a este personaje");
        }
        // Evento para desbloquear badges de count global. enfrentamiento=null
        // porque este voto no pertenece a un bracket; el listener solo usa
        // usuario y cuenta total con countByUsuario.
        eventPublisher.publishEvent(
                new com.diegoalegil.animeshowdown.event.VotoRegistradoEvent(usuario, null));
        return ResponseEntity.ok(guardado);
    }
}
