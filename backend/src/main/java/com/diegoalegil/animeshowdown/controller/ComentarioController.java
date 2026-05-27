package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.ComentarioCrearRequest;
import com.diegoalegil.animeshowdown.dto.ComentarioDto;
import com.diegoalegil.animeshowdown.dto.ComentarioEstadoRequest;
import com.diegoalegil.animeshowdown.dto.PageResponse;
import com.diegoalegil.animeshowdown.model.ComentarioEstado;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.ComentarioService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class ComentarioController {

    private final ComentarioService comentarioService;
    private final AuditLogService auditLogService;

    public ComentarioController(ComentarioService comentarioService, AuditLogService auditLogService) {
        this.comentarioService = comentarioService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/personajes/{slug}/comentarios")
    public PageResponse<ComentarioDto> listarPersonaje(
            @PathVariable String slug,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Usuario usuario) {
        return PageResponse.from(comentarioService.listarPublicos(slug, page(page, size))
                .map(c -> ComentarioDto.from(c, comentarioService.esMio(c, usuario))));
    }

    @PostMapping("/personajes/{slug}/comentarios")
    @ResponseStatus(HttpStatus.CREATED)
    public ComentarioDto crear(
            @PathVariable String slug,
            @Valid @RequestBody ComentarioCrearRequest request,
            @AuthenticationPrincipal Usuario usuario) {
        var comentario = comentarioService.crear(slug, request.contenido(), usuario);
        return ComentarioDto.from(comentario, true);
    }

    @PutMapping("/comentarios/{id}")
    public ComentarioDto actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ComentarioCrearRequest request,
            @AuthenticationPrincipal Usuario usuario) {
        var comentario = comentarioService.actualizar(id, request.contenido(), usuario);
        return ComentarioDto.from(comentario, comentarioService.esMio(comentario, usuario));
    }

    @DeleteMapping("/comentarios/{id}")
    public ComentarioDto eliminar(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuario) {
        var comentario = comentarioService.eliminar(id, usuario);
        return ComentarioDto.from(comentario, comentarioService.esMio(comentario, usuario));
    }

    @PostMapping("/comentarios/{id}/reportar")
    public ComentarioDto reportar(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuario) {
        var comentario = comentarioService.reportar(id, usuario);
        return ComentarioDto.from(comentario, comentarioService.esMio(comentario, usuario));
    }

    @GetMapping("/admin/comentarios")
    public PageResponse<ComentarioDto> listarAdmin(
            @RequestParam(required = false) ComentarioEstado estado,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(comentarioService.listarAdmin(estado, page(page, size))
                .map(c -> ComentarioDto.from(c, false)));
    }

    @PutMapping("/admin/comentarios/{id}/estado")
    public ComentarioDto cambiarEstadoAdmin(
            @PathVariable Long id,
            @Valid @RequestBody ComentarioEstadoRequest request,
            @AuthenticationPrincipal Usuario admin,
            HttpServletRequest httpRequest) {
        var comentario = comentarioService.cambiarEstadoAdmin(id, request.estado());
        auditLogService.registrarAdmin(admin, "admin.comentarios.estado", Map.of(
                "comentarioId", id,
                "estado", request.estado().name()), httpRequest);
        return ComentarioDto.from(comentario, false);
    }

    private static PageRequest page(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
    }
}
