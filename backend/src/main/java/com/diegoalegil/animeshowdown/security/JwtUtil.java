package com.diegoalegil.animeshowdown.security;

import java.util.Date;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;

import com.diegoalegil.animeshowdown.model.Usuario;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    /** Diagnóstico: imprime longitud + 4 chars de cabeza/cola del secret SIN revelar el secret completo. */
    private String secretFingerprint() {
        if (secret == null) return "null";
        if (secret.isEmpty()) return "empty";
        return "len=" + secret.length()
                + " head=" + secret.substring(0, Math.min(4, secret.length()))
                + " tail=" + secret.substring(Math.max(0, secret.length() - 4));
    }

    public String generarToken(Usuario usuario) {
        log.info("JWT generarToken: usuario={} secret-fingerprint={}", usuario.getUsername(), secretFingerprint());
        return JWT.create()
                .withSubject(usuario.getUsername())
                .withClaim("id", usuario.getId())
                .withClaim("rol", usuario.getRol().name())
                .withIssuedAt(new Date())
                .withExpiresAt(new Date(System.currentTimeMillis() + expiration))
                .sign(Algorithm.HMAC256(secret));
    }

    public boolean validarToken(String token) {
        try {
            JWTVerifier verifier = JWT.require(Algorithm.HMAC256(secret)).build();
            verifier.verify(token);
            return true;
        } catch (JWTVerificationException ex) {
            log.warn("JWT validarToken FAIL: {} (secret-fingerprint={})", ex.getMessage(), secretFingerprint());
            return false;
        }
    }

    public String extraerUsername(String token) {
        DecodedJWT decoded = JWT.require(Algorithm.HMAC256(secret)).build().verify(token);
        return decoded.getSubject();
    }
}
