package com.diegoalegil.animeshowdown.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.LogroDto;
import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;
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
        // Merge catálogo + lo que el usuario tiene desbloqueado. Index por
        // logro_id para evitar O(n*m).
        List<UsuarioLogro> mios = badgeService.listarUsuario(usuario);
        Map<Long, UsuarioLogro> indexPorLogro = new HashMap<>();
        for (UsuarioLogro ul : mios) {
            indexPorLogro.put(ul.getLogro().getId(), ul);
        }
        List<LogroDto> respuesta = badgeService.listarCatalogo().stream()
                .map((Logro logro) -> {
                    UsuarioLogro ul = indexPorLogro.get(logro.getId());
                    return ul != null ? LogroDto.desbloqueado(ul) : LogroDto.deCatalogo(logro);
                })
                .toList();
        return ResponseEntity.ok(respuesta);
    }
}
