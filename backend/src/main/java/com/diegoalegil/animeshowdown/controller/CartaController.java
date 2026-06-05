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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.AbrirSobreResultadoDto;
import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.dto.CartaTradeCreateRequest;
import com.diegoalegil.animeshowdown.dto.CartaTradeDto;
import com.diegoalegil.animeshowdown.dto.CofreDiarioDto;
import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.dto.ColeccionPaginaDto;
import com.diegoalegil.animeshowdown.dto.ColeccionResumenDto;
import com.diegoalegil.animeshowdown.dto.MonederoDto;
import com.diegoalegil.animeshowdown.dto.OddsDto;
import com.diegoalegil.animeshowdown.dto.SobreGratisDto;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.CartaDownloadService;
import com.diegoalegil.animeshowdown.service.CartaService;
import com.diegoalegil.animeshowdown.service.CartaTradingService;
import com.diegoalegil.animeshowdown.service.MonederoService;
import com.diegoalegil.animeshowdown.service.RarezaService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * API de cartas coleccionables. Todos los endpoints son autenticados
 * (caen en {@code anyRequest().authenticated()} de SecurityConfig). El servidor
 * es la única autoridad sobre colección, saldo, aperturas e intercambios.
 */
@RestController
@RequestMapping("/api")
public class CartaController {

    private final CartaService cartaService;
    private final CartaDownloadService cartaDownloadService;
    private final CartaTradingService cartaTradingService;
    private final MonederoService monederoService;
    private final RarezaService rarezaService;

    public CartaController(CartaService cartaService, CartaDownloadService cartaDownloadService,
            CartaTradingService cartaTradingService, MonederoService monederoService,
            RarezaService rarezaService) {
        this.cartaService = cartaService;
        this.cartaDownloadService = cartaDownloadService;
        this.cartaTradingService = cartaTradingService;
        this.monederoService = monederoService;
        this.rarezaService = rarezaService;
    }

    /**
     * Colección completa (catálogo + obtenidas + % + saldo). Se mantiene por
     * compatibilidad; el frontend nuevo usa /resumen + /pagina para no cargar el
     * catálogo entero de golpe. */
    @GetMapping("/me/cartas")
    public ColeccionDto miColeccion(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.coleccion(exigirUsuario(usuario));
    }

    /** Cabecera de la colección sin el array de cartas: totales, saldo, pity,
     *  flags y agregados por anime y rareza. */
    @GetMapping("/me/cartas/resumen")
    public ColeccionResumenDto miColeccionResumen(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.resumen(exigirUsuario(usuario));
    }

    /**
     * Página del grid de colección, filtrada por rareza y/o anime. {@code rareza}
     * tolera valores desconocidos/"TODAS" → sin filtro de rareza. {@code limit}
     * se acota a [1, 120]. */
    @GetMapping("/me/cartas/pagina")
    public ColeccionPaginaDto miColeccionPagina(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(required = false) String rareza,
            @RequestParam(required = false) String anime,
            @RequestParam(required = false) String orden,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "60") int limit) {
        int saneLimit = Math.min(120, Math.max(1, limit));
        int saneOffset = Math.max(0, offset);
        return cartaService.pagina(exigirUsuario(usuario), parseRareza(rareza), anime, orden, saneOffset, saneLimit);
    }

    /** Parseo tolerante de rareza: null/blank/"TODAS"/desconocida → null (sin filtro). */
    private static RarezaCarta parseRareza(String rareza) {
        if (rareza == null || rareza.isBlank() || "TODAS".equalsIgnoreCase(rareza)) {
            return null;
        }
        try {
            return RarezaCarta.valueOf(rareza.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
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

    /** Salón Legendario: galería pública de todas las cartas ESPECIAL curadas. */
    @GetMapping("/cartas/especiales")
    public List<CartaDto> especiales() {
        return cartaService.especialesCuradas();
    }

    /** Abre un sobre: gasta moneda y revela 5 cartas. 409 si no hay saldo. */
    @PostMapping("/me/cartas/sobre")
    public AbrirSobreResultadoDto abrirSobre(
            @AuthenticationPrincipal Usuario usuario,
            @RequestHeader(name = "X-Idempotency-Key", required = false) String idempotencyKey) {
        return cartaService.abrirSobre(exigirUsuario(usuario), exigirIdempotencyKey(idempotencyKey));
    }

    @PostMapping("/me/cartas/cofre-diario")
    public CofreDiarioDto cofreDiario(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.reclamarCofreDiario(exigirUsuario(usuario));
    }

    /** Sobre de bienvenida gratuito — 4 SSR + 1 especial garantizada, una sola vez. */
    @PostMapping("/me/cartas/sobre-bienvenida")
    public AbrirSobreResultadoDto sobreBienvenida(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.reclamarSobreBienvenida(exigirUsuario(usuario));
    }

    /** Créditos de sobre gratis pendientes (recompensas de evento por abrir). */
    @GetMapping("/me/cartas/sobres-gratis")
    public List<SobreGratisDto> sobresGratis(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.sobresGratisPendientes(exigirUsuario(usuario));
    }

    /** Abre un crédito de sobre gratis del usuario. 404 si no es suyo, 409 si ya se abrió. */
    @PostMapping("/me/cartas/sobres-gratis/{creditoId}/abrir")
    public AbrirSobreResultadoDto abrirSobreGratis(
            @AuthenticationPrincipal Usuario usuario,
            @PathVariable Long creditoId) {
        return cartaService.abrirSobreGratis(exigirUsuario(usuario), creditoId);
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

    private static String exigirIdempotencyKey(String idempotencyKey) {
        String key = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (key.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "X-Idempotency-Key es obligatorio para abrir sobres");
        }
        return key;
    }
}
