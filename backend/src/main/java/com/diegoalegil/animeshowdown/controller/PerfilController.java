package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EliminarCuentaRequest;
import com.diegoalegil.animeshowdown.dto.VotoHistorialDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.PerfilService;
import com.diegoalegil.animeshowdown.service.ReferralService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * Endpoints REST del perfil del usuario autenticado (Plan v2 §4.1).
 *
 * <p>Todos requieren auth — son sobre el usuario actual ({@code /me}).
 * <ul>
 *   <li>{@code GET /api/perfil/me/stats}</li>
 *   <li>{@code GET /api/perfil/me/historial-votos?page=&size=}</li>
 *   <li>{@code GET /api/perfil/me/top?limit=5}</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/perfil")
public class PerfilController {

    private static final String REFRESH_COOKIE = "refresh_token";

    private final PerfilService perfilService;
    private final UsuarioRepository usuarioRepository;
    private final ReferralService referralService;
    // Mismo flag que usa AuthController para que la cookie de borrado
    // coincida en attributes con la cookie original; algunos navegadores
    // requieren matching de Secure + SameSite para considerar la cookie
    // "la misma" y reemplazarla / borrarla.
    private final boolean cookieSecure;

    public PerfilController(PerfilService perfilService,
            UsuarioRepository usuarioRepository,
            ReferralService referralService,
            @org.springframework.beans.factory.annotation.Value("${app.refresh-token.cookie-secure:true}") boolean cookieSecure) {
        this.perfilService = perfilService;
        this.usuarioRepository = usuarioRepository;
        this.referralService = referralService;
        this.cookieSecure = cookieSecure;
    }

    /**
     * Vista PÚBLICA del perfil de un usuario (Plan v2 §4.5). Stats + top
     * personajes + logros desbloqueados + counts de seguidores en una
     * sola llamada. Si el caller está autenticado, incluye flags
     * {@code siguiendo} y {@code esMismoUsuario} para que el frontend
     * decida si pintar el botón Follow.
     *
     * <p>No expone el historial detallado de votos — eso queda en
     * {@code /api/perfil/me/historial-votos} (privado).
     */
    @GetMapping("/{username}")
    public ResponseEntity<?> perfilPublico(@PathVariable String username,
            @AuthenticationPrincipal Usuario caller) {
        return usuarioRepository.findByUsername(username)
                .map(u -> ResponseEntity.<Object>ok(
                        perfilService.perfilPublico(u, caller, 5)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/me/stats")
    public ResponseEntity<?> miStats(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(perfilService.stats(usuario));
    }

    @GetMapping("/me/historial-votos")
    public ResponseEntity<?> miHistorialVotos(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Page<VotoHistorialDto> result = perfilService.historialVotos(usuario, page, size);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/me/migrar-votos-anonimos")
    public ResponseEntity<?> migrarVotosAnonimos(
            @AuthenticationPrincipal Usuario usuario,
            @RequestBody MigrarVotosAnonimosRequest body) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        int migrados = perfilService.migrarVotosAnonimos(usuario,
                body == null ? null : body.anonSessionId());
        return ResponseEntity.ok(Map.of("migrados", migrados));
    }

    @GetMapping("/me/top")
    public ResponseEntity<?> miTop(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "5") int limit) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(perfilService.top(usuario, limit));
    }

    /**
     * Feed combinado de actividad reciente (Plan v2 §4.1). Mezcla votos
     * en enfrentamientos, logros desbloqueados, torneos creados y
     * predicciones acertadas en orden temporal descendente.
     */
    @GetMapping("/me/actividad")
    public ResponseEntity<?> miActividad(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "20") int limit) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(perfilService.actividadReciente(usuario, limit));
    }

    /**
     * Stats de referral del usuario (Plan v2 §11.8). Devuelve código
     * único compartible + count de referidos verificados + tier badge.
     */
    @GetMapping("/me/referral")
    public ResponseEntity<?> miReferral(@AuthenticationPrincipal Usuario usuario) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        // Si por alguna razón (race condition de migración, edge case)
        // el usuario no tiene código, lo generamos al vuelo y persistimos.
        if (usuario.getReferralCode() == null || usuario.getReferralCode().isBlank()) {
            referralService.asignarCodigoSiHaceFalta(usuario);
            if (usuario.getReferralCode() != null) {
                usuarioRepository.save(usuario);
            }
        }
        return ResponseEntity.ok(referralService.stats(usuario));
    }

    /**
     * Eliminación irreversible de la cuenta (Plan v2 §4.1, GDPR right to
     * erasure). Requiere reconfirmar la contraseña actual aunque el
     * usuario tenga sesión.
     *
     * <p>Tras éxito:
     * <ul>
     *   <li>Audit log evento CUENTA_ELIMINADA con username (para forense
     *       tras el SET NULL del FK audit_log.usuario_id).</li>
     *   <li>BBDD cascade borra refresh tokens, predicciones, logros,
     *       reacciones, notificaciones, follows, backup codes 2FA y
     *       verificaciones. Los votos quedan anónimos (SET NULL).</li>
     *   <li>Cookie de refresh se limpia para que el cliente quede
     *       inmediatamente sin sesión sin redirect manual.</li>
     * </ul>
     */
    @DeleteMapping("/me")
    public ResponseEntity<?> eliminarMiCuenta(
            @AuthenticationPrincipal Usuario usuario,
            @Valid @RequestBody EliminarCuentaRequest body,
            HttpServletRequest httpRequest) {
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // el audit se hace AHORA dentro del service
        // en la misma tx — después de verificar password y antes del delete.
        // Antes se hacía aquí en el controller ANTES del verifyPassword:
        // un password incorrecto generaba un registro CUENTA_ELIMINADA
        // falso. Además el @Async podía persistir tras el delete con FK
        // violation porque el usuario_id ya no existía.
        try {
            perfilService.eliminarCuenta(usuario, body.getPassword(), httpRequest);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
        // Limpia la cookie de refresh para que el frontend no quede con
        // sesión zombie. JS de cliente debe además limpiar el access token.
        // antes hardcodeaba secure=true + SameSite=Lax,
        // pero AuthController emite la cookie con secure=cookieSecure +
        // SameSite=Strict. El mismatch de attributes hace que algunos
        // navegadores no consideren la cookie "la misma" y no la borren —
        // el user queda con refresh zombie en disco hasta que expire.
        ResponseCookie clear = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clear.toString())
                .build();
    }

    public record MigrarVotosAnonimosRequest(String anonSessionId) {}
}
