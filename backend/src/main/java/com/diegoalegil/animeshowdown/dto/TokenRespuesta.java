package com.diegoalegil.animeshowdown.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Respuesta del endpoint /api/auth/login y /api/auth/refresh.
 *
 * <p>En el caso normal (sin 2FA o tras /2fa/verify-login):
 * <pre>{ "token": "eyJ...", "usuario": {...} }</pre>
 *
 * <p>En el caso de login con 2FA pendiente:
 * <pre>{ "requires2fa": true, "challengeToken": "abc...", "expiraEnSegundos": 60 }</pre>
 *
 * <p>Los campos null se omiten con JsonInclude.NON_NULL para no enviar
 * basura al cliente — el frontend chequea {@code requires2fa} primero.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TokenRespuesta(
        String token,
        UsuarioRespuesta usuario,
        /** True si el login pasó la password pero falta el paso de 2FA. */
        Boolean requires2fa,
        /** Token temporal (60s) para llamar /api/auth/2fa/verify-login. */
        String challengeToken,
        /** Segundos de vida del challengeToken — el frontend puede pintar countdown. */
        Long expiraEnSegundos) {

    public TokenRespuesta(String token) {
        this(token, null, null, null, null);
    }

    public TokenRespuesta(String token, UsuarioRespuesta usuario) {
        this(token, usuario, null, null, null);
    }

    /** Factory para la respuesta cuando se requiere el segundo paso de 2FA. */
    public static TokenRespuesta challenge2fa(String challengeToken, long expiraEnSegundos) {
        return new TokenRespuesta(null, null, true, challengeToken, expiraEnSegundos);
    }
}
