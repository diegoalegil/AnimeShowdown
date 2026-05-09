package com.diegoalegil.animeshowdown.security;

import java.util.Date;

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

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    public String generarToken(Usuario usuario) {
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
            return false;
        }
    }

    public String extraerUsername(String token) {
        DecodedJWT decoded = JWT.require(Algorithm.HMAC256(secret)).build().verify(token);
        return decoded.getSubject();
    }
}
