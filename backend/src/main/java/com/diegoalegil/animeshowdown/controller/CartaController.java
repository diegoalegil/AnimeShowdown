package com.diegoalegil.animeshowdown.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.AbrirSobreResultadoDto;
import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.dto.CartaShowcaseDto;
import com.diegoalegil.animeshowdown.dto.CartaShowcaseRequest;
import com.diegoalegil.animeshowdown.dto.CartaTradeCreateRequest;
import com.diegoalegil.animeshowdown.dto.CartaTradeDto;
import com.diegoalegil.animeshowdown.dto.CofreDiarioDto;
import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.dto.MonederoDto;
import com.diegoalegil.animeshowdown.dto.OddsDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.CartaDownloadService;
import com.diegoalegil.animeshowdown.service.CartaService;
import com.diegoalegil.animeshowdown.service.CartaShowcaseService;
import com.diegoalegil.animeshowdown.service.CartaTradingService;
import com.diegoalegil.animeshowdown.service.MonederoService;
import com.diegoalegil.animeshowdown.service.RarezaService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * API de cartas coleccionables. Las rutas /me son autenticadas y el servidor
 * es la única autoridad sobre colección, saldo, aperturas e intercambios.
 */
@RestController
@RequestMapping("/api")
public class CartaController {

    private final CartaService cartaService;
    private final CartaDownloadService cartaDownloadService;
    private final CartaShowcaseService cartaShowcaseService;
    private final CartaTradingService cartaTradingService;
    private final MonederoService monederoService;
    private final RarezaService rarezaService;

    public CartaController(
            CartaService cartaService,
            CartaDownloadService cartaDownloadService,
            CartaShowcaseService cartaShowcaseService,
            CartaTradingService cartaTradingService,
            MonederoService monederoService,
            RarezaService rarezaService) {
        this.cartaService = cartaService;
        this.cartaDownloadService = cartaDownloadService;
        this.cartaShowcaseService = cartaShowcaseService;
        this.cartaTradingService = cartaTradingService;
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

    @GetMapping("/me/cartas/trades")
    public List<CartaTradeDto> misIntercambios(@AuthenticationPrincipal Usuario usuario) {
        return cartaTradingService.listar(exigirUsuario(usuario));
    }

    @PostMapping("/me/cartas/trades")
    public ResponseEntity<CartaTradeDto> crearIntercambio(
            @AuthenticationPrincipal Usuario usuario,
            @RequestBody CartaTradeCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cartaTradingService.crear(exigirUsuario(usuario), request));
    }

    @PostMapping("/me/cartas/trades/{tradeId}/accept")
    public CartaTradeDto aceptarIntercambio(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable Long tradeId) {
        return cartaTradingService.aceptar(exigirUsuario(usuario), tradeId);
    }

    @PostMapping("/me/cartas/trades/{tradeId}/reject")
    public CartaTradeDto rechazarIntercambio(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable Long tradeId) {
        return cartaTradingService.rechazar(exigirUsuario(usuario), tradeId);
    }

    @PostMapping("/me/cartas/trades/{tradeId}/cancel")
    public CartaTradeDto cancelarIntercambio(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable Long tradeId) {
        return cartaTradingService.cancelar(exigirUsuario(usuario), tradeId);
    }

    @GetMapping("/me/cartas/showcase")
    public List<CartaShowcaseDto> misShowcases(@AuthenticationPrincipal Usuario usuario) {
        return cartaShowcaseService.misShowcases(exigirUsuario(usuario));
    }

    @PutMapping("/me/cartas/showcase/{slot}")
    public CartaShowcaseDto fijarShowcase(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable String slot,
            @RequestBody CartaShowcaseRequest request) {
        return cartaShowcaseService.fijar(
                exigirUsuario(usuario),
                cartaShowcaseService.parseSlot(slot),
                request != null ? request.cartaId() : null);
    }

    @DeleteMapping("/me/cartas/showcase/{slot}")
    public ResponseEntity<Void> limpiarShowcase(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable String slot) {
        cartaShowcaseService.limpiar(exigirUsuario(usuario), cartaShowcaseService.parseSlot(slot));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/cartas/showcase/{username}")
    public List<CartaShowcaseDto> showcasePublico(@PathVariable String username) {
        return cartaShowcaseService.publicosDe(username);
    }

    @GetMapping("/cartas/salon-legendario")
    public List<CartaShowcaseDto> salonLegendario() {
        return cartaShowcaseService.salonLegendario();
    }

    @GetMapping("/cartas/personaje/{slug}/especial")
    public CartaDto especialDePersonaje(@PathVariable String slug) {
        return cartaShowcaseService.especialDePersonaje(slug);
    }

    @GetMapping("/cartas/{cartaId}/publica")
    public CartaDto cartaPublica(@PathVariable Long cartaId) {
        return cartaShowcaseService.publica(cartaId);
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
