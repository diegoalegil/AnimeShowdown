package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.diegoalegil.animeshowdown.dto.LogroDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.BadgeService;

/**
 * Endpoints de badges/logros.
 *
 * <ul>
 *   <li>{@code GET /api/logros} — público. Catálogo de badges con
 *       icono, descripción y rareza. El frontend lo cachea long-term porque
 *       es inmutable salvo deploys con migración nueva.</li>
 *   <li>{@code GET /api/logros/mios} — autenticado. Lista enriquecida con
 *       {@code desbloqueadoEn} para los que el usuario tiene; null para
 *       los que aún le faltan. Pensado para pintar el grid completo en
 *       /perfil con los desbloqueados resaltados.</li>
 *   <li>{@code GET /api/logros/stats} — público. Mapa codigo → count con
 *       cuántos usuarios han desbloqueado cada badge. Alimenta /logros
 *       para mostrar rareza real de la comunidad.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/logros")
@Tag(name = "Logros", description = "Catálogo de badges/logros, progreso del usuario y rareza comunitaria.")
public class LogroController {

    private final BadgeService badgeService;

    public LogroController(BadgeService badgeService) {
        this.badgeService = badgeService;
    }

    @GetMapping
    @Operation(summary = "Catálogo de logros",
            description = "Público. Lista de badges con icono, descripción y rareza; inmutable salvo deploys.")
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

    @GetMapping("/stats")
    public ResponseEntity<java.util.Map<String, Long>> stats() {
        return ResponseEntity.ok(badgeService.contarDesbloqueosPorBadge());
    }

    @PostMapping("/otaku-certificado")
    public ResponseEntity<?> otakuCertificado(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        var desbloqueo = badgeService.desbloquear(usuario, "otaku_certificado");
        return ResponseEntity.ok(java.util.Map.of("desbloqueado", desbloqueo.isPresent()));
    }
}
