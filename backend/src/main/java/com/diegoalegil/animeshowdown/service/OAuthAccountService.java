package com.diegoalegil.animeshowdown.service;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.AdminEmails;

/**
 * Link/registro de usuarios que llegan por OAuth. Mantiene el modelo actual:
 * el email es la identidad estable, la cuenta nace ACTIVO porque el proveedor
 * ya verificó el inbox y el login posterior reutiliza JWT + refresh cookie.
 */
@Service
public class OAuthAccountService {

    private static final int USERNAME_MAX = 30;

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final ReferralService referralService;
    private final AdminEmails adminEmails;

    public OAuthAccountService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            ReferralService referralService,
            AdminEmails adminEmails) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.referralService = referralService;
        this.adminEmails = adminEmails;
    }

    @Transactional
    public ResultadoOAuth resolverOCrear(String provider, Map<String, Object> attributes) {
        String email = extraerEmail(provider, attributes);
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("El proveedor OAuth no devolvió email");
        }
        if (!emailVerificado(provider, attributes)) {
            throw new IllegalArgumentException("El proveedor OAuth no confirmó el email");
        }

        String emailNormalizado = email.trim().toLowerCase(Locale.ROOT);
        return usuarioRepository.findByEmail(emailNormalizado)
                .map(usuario -> new ResultadoOAuth(usuario, false))
                .orElseGet(() -> crearUsuarioOAuth(provider, emailNormalizado, attributes));
    }

    private ResultadoOAuth crearUsuarioOAuth(String provider, String email, Map<String, Object> attributes) {
        String username = generarUsername(email);
        Usuario nuevo = new Usuario(
                username,
                passwordEncoder.encode("oauth:" + provider + ":" + UUID.randomUUID()),
                email);
        nuevo.setEstadoVerificacion(EstadoVerificacion.ACTIVO);
        nuevo.setRol(adminEmails.contains(email) ? Rol.ADMIN : Rol.USER);
        String avatar = extraerAvatar(provider, attributes);
        if (avatar != null && !avatar.isBlank()) {
            nuevo.setAvatarUrl(avatar);
        }
        referralService.asignarCodigoSiHaceFalta(nuevo);
        Usuario guardado = usuarioRepository.save(nuevo);
        return new ResultadoOAuth(guardado, true);
    }

    private String generarUsername(String email) {
        int at = email.indexOf('@');
        String local = at > 0 ? email.substring(0, at) : email;
        String base = local
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^A-Za-z0-9_-]+", "_")
                .replaceAll("^_+|_+$", "");
        if (base.length() < 3) {
            base = "otaku_" + base;
        }
        if (base.length() > USERNAME_MAX) {
            base = base.substring(0, USERNAME_MAX);
        }
        if (usuarioRepository.findByUsername(base).isEmpty()) {
            return base;
        }
        for (int i = 2; i < 10_000; i++) {
            String suffix = "_" + i;
            int room = USERNAME_MAX - suffix.length();
            String candidate = base.substring(0, Math.min(base.length(), room)) + suffix;
            if (usuarioRepository.findByUsername(candidate).isEmpty()) {
                return candidate;
            }
        }
        return "otaku_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String extraerEmail(String provider, Map<String, Object> attributes) {
        Object email = attributes.get("email");
        return email == null ? null : email.toString();
    }

    private static boolean emailVerificado(String provider, Map<String, Object> attributes) {
        Object value = switch (provider) {
            case "google" -> attributes.get("email_verified");
            case "discord" -> attributes.get("verified");
            default -> null;
        };
        return value == null || Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(value.toString());
    }

    private static String extraerAvatar(String provider, Map<String, Object> attributes) {
        if ("google".equals(provider)) {
            Object picture = attributes.get("picture");
            return picture == null ? null : picture.toString();
        }
        if ("discord".equals(provider)) {
            Object id = attributes.get("id");
            Object avatar = attributes.get("avatar");
            if (id == null || avatar == null || avatar.toString().isBlank()) {
                return null;
            }
            return "https://cdn.discordapp.com/avatars/" + id + "/" + avatar + ".png?size=128";
        }
        return null;
    }

    public record ResultadoOAuth(Usuario usuario, boolean creado) {}
}
