package com.diegoalegil.animeshowdown.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.diegoalegil.animeshowdown.model.Usuario;

/**
 * Tests unitarios de {@link JwtUtil} — fija el contrato de seguridad del JWT:
 * algoritmo HS256 (rechaza alg:none y firmas con otro secreto), expiración y
 * extracción de claims. Sin contexto Spring; los @Value se inyectan por reflexión.
 */
class JwtUtilTest {

    private static final String SECRET = "test_secret_con_suficiente_entropia_para_hs256_0123456789";

    private JwtUtil jwtUtil;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", SECRET);
        ReflectionTestUtils.setField(jwtUtil, "expiration", 900_000L);
        usuario = new Usuario("alice", "{noop}x", "alice@test.com");
        usuario.setId(1L);
    }

    @Test
    void generaYValidaUnTokenPropio() {
        String token = jwtUtil.generarToken(usuario);
        assertThat(jwtUtil.validarToken(token)).isTrue();
        assertThat(jwtUtil.extraerUsername(token)).isEqualTo("alice");
    }

    @Test
    void generaTokenConVersionActualDelUsuario() {
        usuario.setTokenVersion(7);

        String token = jwtUtil.generarToken(usuario);

        assertThat(jwtUtil.extraerTokenVersion(token)).isEqualTo(7);
    }

    @Test
    void tokenSinVersionCuentaComoVersionCero() {
        String tokenViejo = JWT.create()
                .withSubject("alice")
                .withClaim("id", usuario.getId())
                .withClaim("rol", usuario.getRol().name())
                .withExpiresAt(new Date(System.currentTimeMillis() + 900_000L))
                .sign(Algorithm.HMAC256(SECRET));

        assertThat(jwtUtil.validarToken(tokenViejo)).isTrue();
        assertThat(jwtUtil.extraerTokenVersion(tokenViejo)).isZero();
    }

    @Test
    void rechazaTokenFirmadoConOtroSecreto() {
        JwtUtil otro = new JwtUtil();
        ReflectionTestUtils.setField(otro, "secret", "un_secreto_totalmente_distinto_9876543210_abcdef");
        ReflectionTestUtils.setField(otro, "expiration", 900_000L);
        String tokenForaneo = otro.generarToken(usuario);

        assertThat(jwtUtil.validarToken(tokenForaneo)).isFalse();
    }

    @Test
    void rechazaTokenExpirado() {
        ReflectionTestUtils.setField(jwtUtil, "expiration", -1_000L); // exp en el pasado
        String expirado = jwtUtil.generarToken(usuario);

        assertThat(jwtUtil.validarToken(expirado)).isFalse();
    }

    @Test
    void rechazaAlgNone() {
        Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
        String header = b64.encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = b64.encodeToString("{\"sub\":\"alice\",\"rol\":\"ADMIN\"}".getBytes(StandardCharsets.UTF_8));
        String algNone = header + "." + payload + ".";

        assertThat(jwtUtil.validarToken(algNone)).isFalse();
    }

    @Test
    void rechazaTokenManipulado() {
        String token = jwtUtil.generarToken(usuario);

        assertThat(jwtUtil.validarToken(token + "tampered")).isFalse();
    }
}
