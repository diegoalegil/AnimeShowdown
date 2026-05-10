package com.diegoalegil.animeshowdown.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.JwtUtil;

import java.util.Date;

/**
 * Endpoint TEMPORAL de diagnóstico. Borrar tras resolver el bug de JWT.
 * Genera un token internamente y lo valida inmediatamente en la MISMA request,
 * usando el mismo bean JwtUtil. Si falla, descarta cualquier hipótesis de
 * "dos instancias con secret distinto" porque todo pasa en el mismo JVM tick.
 */
@RestController
@RequestMapping("/api/debug")
public class DebugAuthController {

    private final JwtUtil jwtUtil;
    private final UsuarioRepository usuarioRepository;
    private final String secretRaw;

    public DebugAuthController(
            JwtUtil jwtUtil,
            UsuarioRepository usuarioRepository,
            @Value("${jwt.secret}") String secret) {
        this.jwtUtil = jwtUtil;
        this.usuarioRepository = usuarioRepository;
        this.secretRaw = secret;
    }

    @GetMapping("/jwt-roundtrip")
    public Map<String, Object> roundtrip() {
        Map<String, Object> resp = new HashMap<>();
        resp.put("secret_length", secretRaw == null ? -1 : secretRaw.length());
        resp.put("secret_head", secretRaw == null ? "null" : secretRaw.substring(0, Math.min(4, secretRaw.length())));
        resp.put("secret_tail", secretRaw == null ? "null" : secretRaw.substring(Math.max(0, secretRaw.length() - 4)));
        resp.put("secret_has_whitespace_edges", secretRaw != null && (secretRaw.startsWith(" ") || secretRaw.endsWith(" ") || secretRaw.startsWith("\n") || secretRaw.endsWith("\n")));

        // Coge cualquier user existente (si hay)
        Optional<Usuario> userOpt = usuarioRepository.findAll().stream().findFirst();
        if (userOpt.isEmpty()) {
            resp.put("error", "No hay ningún usuario en la BD para testear");
            return resp;
        }
        Usuario u = userOpt.get();
        resp.put("test_user_username", u.getUsername());
        resp.put("test_user_id", u.getId());

        // 1) Genera con JwtUtil
        String tokenA = jwtUtil.generarToken(u);
        resp.put("step1_token_generado_length", tokenA.length());

        // 2) Valida inmediatamente con JwtUtil
        boolean valid = jwtUtil.validarToken(tokenA);
        resp.put("step2_validado_con_JwtUtil", valid);

        // 3) Genera otro token MANUALMENTE con la misma lib + mismo secret
        String tokenB = JWT.create()
                .withSubject(u.getUsername())
                .withIssuedAt(new Date())
                .withExpiresAt(new Date(System.currentTimeMillis() + 60_000))
                .sign(Algorithm.HMAC256(secretRaw));
        resp.put("step3_token_manual_length", tokenB.length());

        // 4) Valida tokenB con JwtUtil (intercambio de secret entre componentes)
        boolean validB = jwtUtil.validarToken(tokenB);
        resp.put("step4_token_manual_validado_con_JwtUtil", validB);

        // 5) Valida tokenA manualmente con el secret raw
        try {
            DecodedJWT decoded = JWT.require(Algorithm.HMAC256(secretRaw)).build().verify(tokenA);
            resp.put("step5_tokenA_validado_manualmente", true);
            resp.put("step5_subject", decoded.getSubject());
        } catch (JWTVerificationException ex) {
            resp.put("step5_tokenA_validado_manualmente", false);
            resp.put("step5_error", ex.getMessage());
        }

        return resp;
    }
}
