package com.diegoalegil.animeshowdown.controller;

import java.nio.charset.StandardCharsets;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.AbrirSobreResultadoDto;
import com.diegoalegil.animeshowdown.dto.CofreDiarioDto;
import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.dto.MonederoDto;
import com.diegoalegil.animeshowdown.dto.OddsDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.CartaDownloadService;
import com.diegoalegil.animeshowdown.service.CartaService;
import com.diegoalegil.animeshowdown.service.MonederoService;
import com.diegoalegil.animeshowdown.service.RarezaService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * API de cartas coleccionables. Todos los endpoints son autenticados
 * (caen en {@code anyRequest().authenticated()} de SecurityConfig). El servidor
 * es la única autoridad sobre colección, saldo y aperturas.
 */
@RestController
@RequestMapping("/api")
public class CartaController {

    private final CartaService cartaService;
    private final CartaDownloadService cartaDownloadService;
    private final MonederoService monederoService;
    private final RarezaService rarezaService;

    public CartaController(CartaService cartaService, CartaDownloadService cartaDownloadService, MonederoService monederoService,
            RarezaService rarezaService) {
        this.cartaService = cartaService;
        this.cartaDownloadService = cartaDownloadService;
        this.monederoService = monederoService;
        this.rarezaService = rarezaService;
    }

    /** Colección del usuario: catálogo + obtenidas + % + saldo. */
    @GetMapping("/me/cartas")
    public ColeccionDto miColeccion(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.coleccion(exigirUsuario(usuario));
    }

    /** Saldo de moneda del usuario. */
    @GetMapping("/me/monedero")
    public MonederoDto miMonedero(@AuthenticationPrincipal Usuario usuario) {
        return new MonederoDto(monederoService.saldoDe(exigirUsuario(usuario)));
    }

    /** Probabilidades transparentes del sobre (precio, pool, prob. por rareza). */
    @GetMapping("/cartas/odds")
    public OddsDto odds(@AuthenticationPrincipal Usuario usuario) {
        exigirUsuario(usuario);
        return rarezaService.odds();
    }

    /** Abre un sobre: gasta moneda y revela 5 cartas. 409 si no hay saldo. */
    @PostMapping("/me/cartas/sobre")
    public AbrirSobreResultadoDto abrirSobre(
            @AuthenticationPrincipal Usuario usuario,
            @RequestHeader(name = "X-Idempotency-Key", required = false) String idempotencyKey) {
        return cartaService.abrirSobre(exigirUsuario(usuario), idempotencyKey);
    }

    @PostMapping("/me/cartas/cofre-diario")
    public CofreDiarioDto cofreDiario(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.reclamarCofreDiario(exigirUsuario(usuario));
    }

    /** Descarga PNG de una carta poseída. El gate de propiedad vive en backend. */
    @GetMapping(value = "/me/cartas/{cartaId}/descargar", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> descargarCarta(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable Long cartaId,
            HttpServletRequest request) {
        CartaDownloadService.DescargaCarta descarga = cartaDownloadService.descargar(
                exigirUsuario(usuario), cartaId, request);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(descarga.filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(descarga.png());
    }

    private static Usuario exigirUsuario(Usuario usuario) {
        if (usuario == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Necesitas iniciar sesión");
        }
        return usuario;
    }
}
