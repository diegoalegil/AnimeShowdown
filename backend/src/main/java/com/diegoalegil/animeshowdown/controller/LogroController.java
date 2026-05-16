package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.LogroDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.BadgeService;

/**
 * Endpoints de badges/logros (Plan v2 §4.2).
 *
 * <ul>
 *   <li>{@code GET /api/logros} — público. Catálogo de los 14 badges con
 *       icono, descripción y rareza. El frontend lo cachea long-term porque
 *       es inmutable salvo deploys con migración nueva.</li>
 *   <li>{@code GET /api/logros/mios} — autenticado. Lista enriquecida con
 *       {@code desbloqueadoEn} para los que el usuario tiene; null para
 *       los que aún le faltan. Pensado para pintar el grid completo en
 *       /perfil con los desbloqueados resaltados.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/logros")
public class LogroController {

    private final BadgeService badgeService;

    public LogroController(BadgeService badgeService) {
        this.badgeService = badgeService;
    }

    @GetMapping
    public ResponseEntity<List<LogroDto>> catalogo() {
        return ResponseEntity.ok(
                badgeService.listarCatalogo().stream().map(LogroDto::deCatalogo).toList());
    }

    @GetMapping("/mios")
    public ResponseEntity<?> mios(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // El merge se hace dentro de la transacción del service para
        // mantener la session abierta mientras accedemos a UsuarioLogro.logro
        // (relación LAZY). Si lo hiciéramos aquí saldría LazyInitException.
        return ResponseEntity.ok(badgeService.listarCatalogoConDesbloqueos(usuario));
    }
}
