package com.diegoalegil.animeshowdown.controller;

import java.time.Duration;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoCrearRequest;
import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.TorneoCrearMioRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoDetalleDto;
import com.diegoalegil.animeshowdown.dto.TorneoIniciarRequest;
import com.diegoalegil.animeshowdown.dto.TorneoMioDto;
import com.diegoalegil.animeshowdown.dto.TorneoResumenDto;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.TorneoQueryService;
import com.diegoalegil.animeshowdown.service.TorneoService;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Controller "delgado": solo orquesta HTTP y delega toda la lógica a
 * TorneoService. Los errores de negocio se propagan como excepciones que
 * GlobalExceptionHandler convierte a respuestas con shape JSON unificado
 * (EntityNotFoundException → 404, IllegalStateException → 409,
 * IllegalArgumentException → 400).
 */
@RestController
@RequestMapping("/api/torneos")
@Tag(name = "Torneos", description = "Torneos de eliminación directa: listado, detalle por slug y bracket en vivo.")
public class TorneoController {

    private static final CacheControl LISTA_PUBLICA_CACHE = CacheControl
            .maxAge(Duration.ofSeconds(30))
            .cachePublic()
            .sMaxAge(Duration.ofMinutes(2));
    private static final CacheControl DETALLE_LIVE_CACHE = CacheControl
            .maxAge(Duration.ofSeconds(5))
            .cachePublic()
            .sMaxAge(Duration.ofSeconds(10));
    private static final CacheControl DETALLE_MUTABLE_CACHE = CacheControl
            .maxAge(Duration.ofSeconds(30))
            .cachePublic()
            .sMaxAge(Duration.ofMinutes(1));
    private static final CacheControl DETALLE_FINALIZADO_CACHE = CacheControl
            .maxAge(Duration.ofMinutes(5))
            .cachePublic()
            .sMaxAge(Duration.ofMinutes(10));

    private final TorneoService torneoService;
    private final TorneoQueryService torneoQueryService;

    public TorneoController(TorneoService torneoService, TorneoQueryService torneoQueryService) {
        this.torneoService = torneoService;
        this.torneoQueryService = torneoQueryService;
    }

    /**
     * Listado de torneos en formato DTO. Antes devolvía entidades JPA
     * directas (problema N+1 por colecciones lazy, exposición de campos
     * internos). 1: el frontend lo consume con react-query.
     */
    @GetMapping
    @Operation(summary = "Listar torneos",
            description = "Público. Resumen de todos los torneos (activos, en curso y finalizados), cacheado.")
    public ResponseEntity<List<TorneoResumenDto>> listarTodos() {
        return ResponseEntity.ok()
                .cacheControl(LISTA_PUBLICA_CACHE)
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING)
                .body(torneoQueryService.listarResumenes());
    }

    /**
     * Detalle de torneo + bracket completo. Usado por TorneoDetailPage
     * con polling cada 30s durante torneos IN_PROGRESS.
     */
    @GetMapping("/{id}")
    public ResponseEntity<TorneoDetalleDto> detallePorId(@PathVariable Long id) {
        return cachearDetalle(torneoQueryService.findById(id));
    }

    /**
     * Detalle por slug URL-safe. Es la ruta que consume el frontend para
     * `/torneos/{slug}` — coincide con el shape canonical de las URLs
     * y permite caching CDN agresivo.
     */
    @GetMapping("/slug/{slug}")
    public ResponseEntity<TorneoDetalleDto> detallePorSlug(@PathVariable String slug) {
        return cachearDetalle(torneoQueryService.findBySlug(slug));
    }

    private ResponseEntity<TorneoDetalleDto> cachearDetalle(TorneoDetalleDto dto) {
        return ResponseEntity.ok()
                .cacheControl(cacheDetalle(dto))
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING)
                .body(dto);
    }

    private CacheControl cacheDetalle(TorneoDetalleDto dto) {
        if (dto.getEstado() == EstadoTorneo.IN_PROGRESS) {
            return DETALLE_LIVE_CACHE;
        }
        if (dto.getEstado() == EstadoTorneo.FINISHED) {
            return DETALLE_FINALIZADO_CACHE;
        }
        return DETALLE_MUTABLE_CACHE;
    }

    @PostMapping
    public TorneoResumenDto crear(@Valid @RequestBody TorneoCrearRequest request) {
        // DTO en vez de la entidad Torneo cruda: evita exponer relaciones
        // internas (creadoPor/ganadorPersonaje) y acoplar el contrato a la entidad.
        return TorneoResumenDto.fromEntity(torneoService.crear(request));
    }

    /**
     * Crea un torneo a partir de un usuario verificado.
     * Bracket precomputado pero estado_revision=PENDIENTE hasta que admin
     * apruebe. Hasta entonces, no aparece en GET /api/torneos público —
     * solo en /api/torneos/mios del creador y /api/admin/torneos/pendientes.
     */
    @PostMapping("/mio")
    public ResponseEntity<TorneoMioDto> crearMio(
            @AuthenticationPrincipal Usuario creador,
            @Valid @RequestBody TorneoCrearMioRequest request) {
        if (creador == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Torneo guardado = torneoService.crearPorUsuario(creador, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TorneoMioDto.from(guardado));
    }

    /**
     * Lista los torneos creados por el usuario autenticado, en cualquier
     * estado de revisión. 9: el creador debe ver sus PENDIENTES
     * (esperando), APROBADOS (en juego) y RECHAZADOS (con motivo) para
     * tener feedback claro del flujo de moderación.
     */
    @GetMapping("/mios")
    public ResponseEntity<List<TorneoMioDto>> listarMios(
            @AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        List<TorneoMioDto> mios = torneoService.listarTorneosDelUsuario(usuario)
                .stream()
                .map(TorneoMioDto::from)
                .toList();
        return ResponseEntity.ok(mios);
    }

    /**
     * Inicia el torneo. Body opcional con `participantesIds` para que el
     * servicio cree el bracket completo en cascada. Si llega
     * sin body, solo cambia estado a IN_PROGRESS y deja la creación de
     * enfrentamientos al endpoint /enfrentamientos.
     */
    @PutMapping("/{id}/iniciar")
    public ResponseEntity<TorneoResumenDto> iniciar(
            @PathVariable Long id,
            @RequestBody(required = false) TorneoIniciarRequest request) {
        return ResponseEntity.ok(TorneoResumenDto.fromEntity(torneoService.iniciar(id, request)));
    }

    @PostMapping("/{id}/enfrentamientos")
    public ResponseEntity<List<EnfrentamientoDto>> crearEnfrentamientos(
            @PathVariable Long id,
            @Valid @RequestBody List<@Valid EnfrentamientoCrearRequest> requests) {
        List<Enfrentamiento> creados = torneoService.crearEnfrentamientos(id, requests);
        List<EnfrentamientoDto> dtos = creados.stream()
                .map(e -> EnfrentamientoDto.from(e, 0L))
                .toList();
        return ResponseEntity.status(HttpStatus.CREATED).body(dtos);
    }

    @PutMapping("/{id}/finalizar")
    public ResponseEntity<TorneoResumenDto> finalizar(@PathVariable Long id) {
        return ResponseEntity.ok(TorneoResumenDto.fromEntity(torneoService.finalizar(id)));
    }
}
