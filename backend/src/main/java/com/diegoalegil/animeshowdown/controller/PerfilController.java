package com.diegoalegil.animeshowdown.controller;

import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.CambioBioRequest;
import com.diegoalegil.animeshowdown.dto.EliminarCuentaRequest;
import com.diegoalegil.animeshowdown.dto.PageResponse;
import com.diegoalegil.animeshowdown.dto.UsuarioRespuesta;
import com.diegoalegil.animeshowdown.dto.VotoHistorialDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.AnonymousIdentityService;
import com.diegoalegil.animeshowdown.service.PerfilService;
import com.diegoalegil.animeshowdown.service.ReferralService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * Endpoints REST del perfil del usuario autenticado.
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
    private final AnonymousIdentityService anonymousIdentityService;
    // Mismo flag que usa AuthController para que la cookie de borrado
    // coincida en attributes con la cookie original; algunos navegadores
    // requieren matching de Secure + SameSite para considerar la cookie
    // "la misma" y reemplazarla / borrarla.
    private final boolean cookieSecure;

    public PerfilController(PerfilService perfilService,
            UsuarioRepository usuarioRepository,
            ReferralService referralService,
            AnonymousIdentityService anonymousIdentityService,
            @org.springframework.beans.factory.annotation.Value("${app.refresh-token.cookie-secure:true}") boolean cookieSecure) {
        this.perfilService = perfilService;
        this.usuarioRepository = usuarioRepository;
        this.referralService = referralService;
        this.anonymousIdentityService = anonymousIdentityService;
        this.cookieSecure = cookieSecure;
    }

    /**
     * Vista PÚBLICA del perfil de un usuario. Stats + top
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
        var result = perfilService.historialVotos(usuario, page, size);
        return ResponseEntity.ok(PageResponse.from(result));
    }

    @PostMapping("/me/migrar-votos-anonimos")
    public ResponseEntity<?> migrarVotosAnonimos(
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest request) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        int migrados = perfilService.migrarVotosAnonimos(usuario,
                anonSessionIdDesdeCookieFirmada(request));
        return ResponseEntity.ok(Map.of("migrados", migrados));
    }

    private String anonSessionIdDesdeCookieFirmada(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) {
            return null;
        }
        String cookieName = anonymousIdentityService.getCookieName();
        for (Cookie cookie : request.getCookies()) {
            if (cookieName.equals(cookie.getName())) {
                var verified = anonymousIdentityService.verify(cookie.getValue());
                if (verified.isPresent()) {
                    return verified.get();
                }
            }
        }
        return null;
    }

    @GetMapping("/me/top")
    public ResponseEntity<?> miTop(
            @AuthenticationPrincipal Usuario usuario,
            @RequestParam(defaultValue = "5") int limit) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(perfilService.top(usuario, limit));
    }

    /**
     * Feed combinado de actividad reciente. Mezcla votos
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
     * Stats de referral del usuario. Devuelve código
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
                referralService.guardarTolerandoColisionReferral(usuario);
            }
        }
        return ResponseEntity.ok(referralService.stats(usuario));
    }

    /**
     * Edita la bio pública del usuario (B7 §1a). Texto plano, máx
     * 240 chars; el servicio hace strip de HTML y trim. Enviar bio vacía la
     * borra. Devuelve el {@link UsuarioRespuesta} actualizado para que el
     * frontend refresque su copia del usuario sin un GET extra.
     */
    @PatchMapping("/me/bio")
    public ResponseEntity<?> actualizarMiBio(
            @AuthenticationPrincipal Usuario usuario,
            @Valid @RequestBody CambioBioRequest body,
            HttpServletRequest httpRequest) {
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Usuario actualizado = perfilService.actualizarBio(usuario,
                body == null ? null : body.bio(), httpRequest);
        return ResponseEntity.ok(new UsuarioRespuesta(actualizado));
    }

    /**
     * Eliminación irreversible de la cuenta (GDPR right to
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
        // El audit se hace dentro del service
        // en la misma tx — después de verificar password y antes del delete.
        // Antes se hacía aquí en el controller ANTES del verifyPassword:
        // un password incorrecto generaba un registro CUENTA_ELIMINADA
        // falso. Además el @Async podía persistir tras el delete con FK
        // violation porque el usuario_id ya no existía.
        try {
            perfilService.eliminarCuenta(usuario, body.password(), httpRequest);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
        // Limpia la cookie de refresh para que el frontend no quede con
        // sesión zombie. JS de cliente debe además limpiar el access token.
        // §SEC-005: debe coincidir con la cookie que emite AuthController
        // (secure=cookieSecure + SameSite=Lax). El navegador solo borra una
        // cookie si los atributos coinciden con la original; el mismatch previo
        // (aquí Strict vs Lax en AuthController) dejaba un refresh zombie en disco.
        ResponseCookie clear = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(0)
                .build();
        // También la legacy con Path=/ de sesiones anteriores al cambio de path.
        ResponseCookie clearLegacy = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clear.toString())
                .header(HttpHeaders.SET_COOKIE, clearLegacy.toString())
                .build();
    }
}
