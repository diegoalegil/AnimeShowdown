package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
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
import com.diegoalegil.animeshowdown.dto.PageResponse;
import com.diegoalegil.animeshowdown.dto.PersonajeActualizarRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeBusquedaDto;
import com.diegoalegil.animeshowdown.dto.PersonajeCatalogoDto;
import com.diegoalegil.animeshowdown.dto.PersonajeCrearRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeSimilarDto;
import com.diegoalegil.animeshowdown.dto.VotosPeriodoDto;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.PersonajeSlugAliases;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.service.EloHistoryService;
import com.diegoalegil.animeshowdown.service.JikanService;
import com.diegoalegil.animeshowdown.service.PersonajeAdminService;
import com.diegoalegil.animeshowdown.service.PersonajeBusquedaService;
import com.diegoalegil.animeshowdown.service.PersonajeCatalogoService;
import com.diegoalegil.animeshowdown.service.PersonajeMatchupService;
import com.diegoalegil.animeshowdown.service.RecomendacionService;
import com.diegoalegil.animeshowdown.service.VotosPeriodoService;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/personajes")
@Tag(name = "Personajes", description = "Catálogo de personajes anime: listado paginado, búsqueda, fichas y ELO.")
public class PersonajeController {

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final String DEFAULT_PAGE_SIZE_PARAM = "50";
    private static final int MAX_PAGE_SIZE = 100;

    /** Key de caché del listado público: MISMA normalización que el body (anime
     *  trim + null→all, page/size clamped) → queries lógicamente iguales comparten
     *  entrada en personajes-listado en vez de gastar slots con params crudos. */
    public static String listadoCacheKey(String anime, int page, int size) {
        String a = (anime == null || anime.isBlank()) ? "all" : anime.trim();
        return a + ":" + Math.max(0, page) + ":" + Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    }

    private final PersonajeRepository personajeRepository;
    private final RecomendacionService recomendacionService;
    private final EloHistoryService eloHistoryService;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final PersonajeMatchupService personajeMatchupService;
    private final VotosPeriodoService votosPeriodoService;
    private final JikanService jikanService;
    private final PersonajeCatalogoService personajeCatalogoService;
    private final PersonajeBusquedaService personajeBusquedaService;
    private final PersonajeAdminService personajeAdminService;

    public PersonajeController(PersonajeRepository personajeRepository,
            RecomendacionService recomendacionService,
            EloHistoryService eloHistoryService,
            EnfrentamientoRepository enfrentamientoRepository,
            PersonajeMatchupService personajeMatchupService,
            VotosPeriodoService votosPeriodoService,
            JikanService jikanService,
            PersonajeCatalogoService personajeCatalogoService,
            PersonajeBusquedaService personajeBusquedaService,
            PersonajeAdminService personajeAdminService) {
        this.personajeRepository = personajeRepository;
        this.recomendacionService = recomendacionService;
        this.eloHistoryService = eloHistoryService;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.personajeMatchupService = personajeMatchupService;
        this.votosPeriodoService = votosPeriodoService;
        this.jikanService = jikanService;
        this.personajeCatalogoService = personajeCatalogoService;
        this.personajeBusquedaService = personajeBusquedaService;
        this.personajeAdminService = personajeAdminService;
    }

    /**
     * Listado público paginado. El catálogo completo vive en /catalogo para
     * evitar respuestas masivas desde este endpoint.
     *
     * <p>Devuelve {@link PersonajeCatalogoDto}, no la entidad JPA cruda: así no
     * se filtran columnas internas ({@code eloSemilla}, {@code popularidadFuente},
     * {@code genero}) que el cliente no consume y que son detalle de
     * implementación. El cache Caffeine es in-memory y nace vacío en cada
     * redeploy, así que el cambio de tipo no necesita migración.
     */
    @Cacheable(value = "personajes-listado",
            key = "T(com.diegoalegil.animeshowdown.controller.PersonajeController).listadoCacheKey(#anime, #page, #size)")
    @GetMapping
    @Operation(summary = "Listar personajes",
            description = "Público. Catálogo paginado con filtro opcional por anime. Soporta page/size.")
    public PageResponse<PersonajeCatalogoDto> listarTodos(
            @RequestParam(required = false) String anime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = DEFAULT_PAGE_SIZE_PARAM) int size) {
        String animeNormalizado = anime == null || anime.isBlank() ? null : anime.trim();
        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.min(MAX_PAGE_SIZE, Math.max(1, size)),
                Sort.by("id").ascending());
        Page<Personaje> pagina = animeNormalizado != null
                ? personajeRepository.findByAnime(animeNormalizado, pageable)
                : personajeRepository.findAll(pageable);
        return PageResponse.from(pagina.map(PersonajeCatalogoDto::from));
    }

    /**
     * Catálogo público compacto para frontend y sitemap.
     *
     * <p>fields permite bajar solo columnas necesarias:
     * {@code slug,nombre,anime,imagenUrl}. El endpoint emite ETag estable,
     * Cache-Control con s-maxage=3600 para CDN y Vary: Accept-Encoding para
     * que gzip/brotli del proxy no mezclen variantes.
     */
    @GetMapping("/catalogo")
    public ResponseEntity<?> catalogo(
            @RequestParam(required = false) String fields,
            @org.springframework.web.bind.annotation.RequestHeader(
                    value = HttpHeaders.IF_NONE_MATCH,
                    required = false) String ifNoneMatch) {
        String fieldsKey = personajeCatalogoService.normalizarFields(fields);
        var payload = personajeCatalogoService.catalogo(fieldsKey);
        CacheControl cacheControl = CacheControl.maxAge(java.time.Duration.ofMinutes(5))
                .cachePublic()
                .sMaxAge(java.time.Duration.ofHours(1));
        if (etagMatches(ifNoneMatch, payload.etag())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .cacheControl(cacheControl)
                    .eTag(payload.etag())
                    .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING)
                    .build();
        }
        return ResponseEntity.ok()
                .cacheControl(cacheControl)
                .eTag(payload.etag())
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING)
                .body(payload.items());
    }

    @GetMapping("/buscar")
    public List<PersonajeBusquedaDto> buscar(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit) {
        return personajeBusquedaService.buscar(q, limit);
    }

    /**
     * Personaje aleatorio para la ruleta pública.
     *
     * <p>No se cachea: cada click debe consultar una selección nueva. Si
     * llega exclude, se evita devolver ese slug siempre que haya alternativas.
     */
    @GetMapping("/aleatorio")
    public ResponseEntity<Personaje> aleatorio(
            @RequestParam(name = "exclude", required = false) String excludeSlug) {
        String excluded = normalizeOptionalSlug(excludeSlug);
        List<Personaje> seleccion = excluded == null
                ? personajeRepository.findRandom(1)
                : personajeRepository.findRandomExcluding(excluded, 1);
        if (seleccion.isEmpty() && excluded != null) {
            seleccion = personajeRepository.findRandom(1);
        }
        if (seleccion.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(seleccion.get(0));
    }

    /**
     * Batch público para sparklines de ranking. Evita disparar 10 requests
     * independientes desde /ranking cuando solo necesitamos la mini serie de
     * los Top 10 visibles.
     */
    @GetMapping("/elo-history")
    public Map<String, List<EloHistoryPoint>> eloHistoryBatch(
            @RequestParam String slugs,
            @RequestParam(defaultValue = "7") int dias) {
        int saneDias = Math.max(1, Math.min(90, dias));
        List<String> lista = java.util.Arrays.stream(slugs.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .limit(25)
                .toList();
        return eloHistoryService.historialBatch(lista, saneDias);
    }

    /** Cache individual 5min por id — usado por /personajes/{id}. */
    @Cacheable(value = "personajes-individual", key = "#id")
    @GetMapping("/{id:\\d+}")
    public PersonajeCatalogoDto buscarPorId(@PathVariable Long id) {
        return PersonajeCatalogoDto.from(personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id)));
    }

    /** Cache individual 5min por slug — usado por clientes públicos y docs. */
    @Cacheable(value = "personajes-individual", key = "'slug:' + #slug")
    @GetMapping("/{slug:[A-Za-z][A-Za-z0-9_-]*}")
    public PersonajeCatalogoDto buscarPorSlug(@PathVariable String slug) {
        return PersonajeCatalogoDto.from(buscarPersonajePorSlugOCualquierAlias(slug));
    }

    /**
     * Crea un personaje desde un DTO validado. Antes aceptaba la entidad
     * Personaje directa sin @Valid, permitiendo slugs vacíos o caracteres
     * inválidos. Ahora PersonajeCrearRequest impone formato del slug,
     * longitudes y obligatoriedad de slug/nombre/anime.
     */
    /**
     * Crea un personaje desde un DTO validado. La escritura (build + save +
     * invalidación de cachés/índice) vive en {@link PersonajeAdminService}.
     */
    @PostMapping
    public ResponseEntity<PersonajeCatalogoDto> crear(@Valid @RequestBody PersonajeCrearRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(PersonajeCatalogoDto.from(personajeAdminService.crear(request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        return personajeAdminService.eliminar(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    /**
     * Actualización parcial: el cliente manda solo los campos a cambiar.
     * Los null se ignoran (preservan el valor previo). PersonajeActualizar
     * Request valida formato y tamaño pero no obliga a estar presentes.
     */
    @PutMapping("/{id}")
    public PersonajeCatalogoDto actualizar(
            @PathVariable Long id,
            @Valid @RequestBody PersonajeActualizarRequest datos) {
        return PersonajeCatalogoDto.from(personajeAdminService.actualizar(id, datos));
    }

    @PostMapping("/batch")
    public List<PersonajeCatalogoDto> crearBatch(@RequestBody List<@Valid PersonajeCrearRequest> personajes) {
        return personajeAdminService.crearBatch(personajes).stream()
                .map(PersonajeCatalogoDto::from)
                .toList();
    }

    /**
     * Personajes similares al de un slug. Discovery
     * cross-anime basado en proximidad de votos.
     *
     * <p>Endpoint público. limit clampa entre 1 y 24; default 8.
     */
    @GetMapping("/{slug}/similares")
    public List<PersonajeSimilarDto> similares(@PathVariable String slug,
            @RequestParam(defaultValue = "8") int limit) {
        return recomendacionService.similares(PersonajeSlugAliases.canonical(slug), limit);
    }

    /**
     * Time machine del ELO — serie temporal de votos
     * acumulados día a día. dias clampa entre 1 y 90; default 30.
     */
    @GetMapping("/{slug}/elo-history")
    public List<EloHistoryPoint> eloHistory(@PathVariable String slug,
            @RequestParam(defaultValue = "30") int dias) {
        return eloHistoryService.historial(PersonajeSlugAliases.canonical(slug), dias);
    }

    /**
     * Historial de duelos recientes del personaje.
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
        var personajeOpt = personajeRepository.findBySlug(PersonajeSlugAliases.canonical(slug));
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
     * Actividad reciente de votos del personaje.
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
            return ResponseEntity.ok(votosPeriodoService.calcularSlug(PersonajeSlugAliases.canonical(slug), saneDias));
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
                .map(PersonajeSlugAliases::canonical)
                .filter(s -> !s.isEmpty())
                .distinct()
                .limit(50)
                .toList();
        return votosPeriodoService.calcularBatch(lista, saneDias);
    }

    /**
     * Resumen agregado "Contra quién" — mejores/peores/frecuentes
     * matchups. Sin auth.
     *
     * <p>404 si el slug no existe; 200 con listas vacías y total=0 si
     * el personaje no tiene aún enfrentamientos decididos (el frontend
     * pinta empty state "Aún necesita más duelos").
     */
    @GetMapping("/{slug}/matchups")
    public ResponseEntity<MatchupResumenDto> matchups(@PathVariable String slug) {
        try {
            return ResponseEntity.ok(personajeMatchupService.calcular(PersonajeSlugAliases.canonical(slug)));
        } catch (EntityNotFoundException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Galería de imágenes adicionales del personaje desde Jikan. Devuelve hasta 12 URLs de
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
        var personajeOpt = personajeRepository.findBySlug(PersonajeSlugAliases.canonical(slug));
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
     * Deshabilitado (nota): tras dropear el unique
     * uk_voto_personaje_usuario en V16, el check app-level
     * existsByPersonajeAndUsuario era vulnerable a doble voto bajo
     * concurrencia. El endpoint canónico vive en otro recurso (enfrentamiento,
     * no personaje), así que no hay redirect 1:1.
     *
     * <p>quitado el header Link al
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

    private boolean etagMatches(String ifNoneMatch, String etag) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank()) {
            return false;
        }
        return java.util.Arrays.stream(ifNoneMatch.split(","))
                .map(String::trim)
                .anyMatch(candidate -> candidate.equals(etag) || candidate.equals("W/" + etag));
    }

    private Personaje buscarPersonajePorSlugOCualquierAlias(String slug) {
        String canonical = PersonajeSlugAliases.canonical(slug);
        return personajeRepository.findBySlug(canonical)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: slug=" + slug));
    }

    private String normalizeOptionalSlug(String slug) {
        if (slug == null || slug.isBlank()) {
            return null;
        }
        return PersonajeSlugAliases.canonical(slug.trim());
    }
}
