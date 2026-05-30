package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.AbrirSobreResultadoDto;
import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.dto.MonederoDto;
import com.diegoalegil.animeshowdown.dto.OddsDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.CartaService;
import com.diegoalegil.animeshowdown.service.MonederoService;
import com.diegoalegil.animeshowdown.service.RarezaService;

/**
 * API de cartas coleccionables (Fase 1). Todos los endpoints son autenticados
 * (caen en {@code anyRequest().authenticated()} de SecurityConfig). El servidor
 * es la única autoridad sobre colección, saldo y aperturas.
 */
@RestController
@RequestMapping("/api")
public class CartaController {

    private final CartaService cartaService;
    private final MonederoService monederoService;
    private final RarezaService rarezaService;

    public CartaController(CartaService cartaService, MonederoService monederoService,
            RarezaService rarezaService) {
        this.cartaService = cartaService;
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

    /** Abre un sobre: gasta moneda y revela una carta. 409 si no hay saldo. */
    @PostMapping("/me/cartas/sobre")
    public AbrirSobreResultadoDto abrirSobre(@AuthenticationPrincipal Usuario usuario) {
        return cartaService.abrirSobre(exigirUsuario(usuario));
    }

    private static Usuario exigirUsuario(Usuario usuario) {
        if (usuario == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Necesitas iniciar sesión");
        }
        return usuario;
    }
}
