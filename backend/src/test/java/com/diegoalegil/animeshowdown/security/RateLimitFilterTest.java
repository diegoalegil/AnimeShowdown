package com.diegoalegil.animeshowdown.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

import jakarta.servlet.http.HttpServletRequest;

class RateLimitFilterTest {

    private ClientIpExtractor clientIpExtractor;
    private JwtUtil jwtUtil;
    private UsuarioRepository usuarioRepository;
    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        clientIpExtractor = mock(ClientIpExtractor.class);
        jwtUtil = mock(JwtUtil.class);
        usuarioRepository = mock(UsuarioRepository.class);
        when(clientIpExtractor.extract(any(HttpServletRequest.class))).thenReturn("203.0.113.10");
        filter = new RateLimitFilter(true, clientIpExtractor, jwtUtil, usuarioRepository);
    }

    @Test
    void loginPermiteDiezPeticionesPorMinuto() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertEquals(200, post("/api/auth/login").getStatus());
        }

        assertEquals(429, post("/api/auth/login").getStatus());
    }

    @Test
    void registroPermiteCincoPeticionesPorMinuto() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertEquals(200, post("/api/auth/registro").getStatus());
        }

        assertEquals(429, post("/api/auth/registro").getStatus());
    }

    @Test
    void resetPasswordComparteTresPeticionesPorMinutoEntreForgotYReset() throws Exception {
        assertEquals(200, post("/api/auth/forgot-password").getStatus());
        assertEquals(200, post("/api/auth/reset-password").getStatus());
        assertEquals(200, post("/api/auth/forgot-password").getStatus());

        assertEquals(429, post("/api/auth/reset-password").getStatus());
    }

    @Test
    void votosPermitenSesentaPeticionesPorMinuto() throws Exception {
        for (int i = 0; i < 60; i++) {
            assertEquals(200, post("/api/enfrentamientos/42/votar").getStatus());
        }

        assertEquals(429, post("/api/personajes/42/votar").getStatus());
    }

    @Test
    void newsletterPermiteCincoPeticionesPorHoraSinConsumirLogin() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertEquals(200, post("/api/newsletter").getStatus());
        }

        assertEquals(429, post("/api/newsletter").getStatus());
        assertEquals(200, post("/api/auth/login").getStatus());
    }

    @Test
    void ogImagePermiteSesentaPeticionesPorMinuto() throws Exception {
        for (int i = 0; i < 60; i++) {
            assertEquals(200, get("/api/og/duelo/naruto/vs/luffy.png").getStatus());
        }

        assertEquals(429, get("/api/og/personaje/goku.png").getStatus());
    }

    @Test
    void descargaCartaPermiteTreintaPeticionesPorMinuto() throws Exception {
        for (int i = 0; i < 30; i++) {
            assertEquals(200, get("/api/me/cartas/" + i + "/descargar").getStatus());
        }

        assertEquals(429, get("/api/me/cartas/999/descargar").getStatus());
    }

    @Test
    void eloDuelLimitaTreintaPorMinutoEntreRoundYGuess() throws Exception {
        // GET /round y POST /guess comparten el bucket "elo-duel" por IP.
        for (int i = 0; i < 30; i++) {
            assertEquals(200, get("/api/games/elo-duel/round").getStatus());
        }
        assertEquals(429, get("/api/games/elo-duel/round").getStatus());
        assertEquals(429, post("/api/games/elo-duel/guess").getStatus());
    }

    @Test
    void wrappedPublicoLimitaTreintaGetPorMinuto() throws Exception {
        // GET /api/wrapped/u/{username} (permitAll, 5+ queries no cacheadas): 30/min por IP.
        for (int i = 0; i < 30; i++) {
            assertEquals(200, get("/api/wrapped/u/usuario" + i).getStatus());
        }
        assertEquals(429, get("/api/wrapped/u/otro").getStatus());
    }

    @Test
    void getNoCostosoNoSeLimita() throws Exception {
        // Un GET corriente (no OG ni descarga) no consume bucket: ilimitado.
        for (int i = 0; i < 100; i++) {
            assertEquals(200, get("/api/me/cartas").getStatus());
        }
    }

    @Test
    void economiaPermiteSesentaPostDeCartasPorMinuto() throws Exception {
        for (int i = 0; i < 60; i++) {
            assertEquals(200, post("/api/me/cartas/sobre").getStatus());
        }
        assertEquals(429, post("/api/me/cartas/sobre").getStatus());
    }

    @Test
    void economiaComparteBucketEntreAccionesDeCartas() throws Exception {
        for (int i = 0; i < 30; i++) {
            assertEquals(200, post("/api/me/cartas/sobre").getStatus());
        }
        for (int i = 0; i < 30; i++) {
            assertEquals(200, post("/api/me/cartas/cofre-diario").getStatus());
        }
        // El bucket "economia" es compartido por IP: ya consumido, el siguiente POST 429.
        assertEquals(429, post("/api/me/cartas/sobre-bienvenida").getStatus());
    }

    @Test
    void economiaNoConsumeElBucketDeVotos() throws Exception {
        for (int i = 0; i < 60; i++) {
            post("/api/me/cartas/sobre");
        }
        // Buckets independientes por policyId: agotar economía no afecta a votos.
        assertEquals(200, post("/api/personajes/1/votar").getStatus());
    }

    @Test
    void socialPermiteSesentaReaccionesPorMinuto() throws Exception {
        for (int i = 0; i < 60; i++) {
            assertEquals(200, post("/api/reacciones").getStatus());
        }
        assertEquals(429, post("/api/reacciones").getStatus());
    }

    @Test
    void tokenAdminSaltaRateLimitEnPoliciesNoAuth() throws Exception {
        Usuario admin = new Usuario("admin", "password", "admin@example.com");
        admin.setRol(Rol.ADMIN);
        when(jwtUtil.validarToken("admin-token")).thenReturn(true);
        when(jwtUtil.extraerUsername("admin-token")).thenReturn("admin");
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        // Economía (sí concede bypass): el admin agota el límite por IP y luego lo
        // salta con su token (operativa legítima de admin sobre cartas).
        for (int i = 0; i < 60; i++) {
            assertEquals(200, post("/api/me/cartas/sobre").getStatus());
        }
        assertEquals(429, post("/api/me/cartas/sobre").getStatus());

        assertEquals(200, post("/api/me/cartas/sobre", "Bearer admin-token").getStatus());
    }

    @Test
    void tokenAdminNoSaltaRateLimitSocial() throws Exception {
        // Social = CREACIÓN de contenido (reacciones/comentarios/seguir), no
        // moderación (que va por endpoints de admin aparte). El límite es
        // universal: un token admin comprometido no debe poder spamear sin freno.
        Usuario admin = new Usuario("admin", "password", "admin@example.com");
        admin.setRol(Rol.ADMIN);
        when(jwtUtil.validarToken("admin-token")).thenReturn(true);
        when(jwtUtil.extraerUsername("admin-token")).thenReturn("admin");
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        for (int i = 0; i < 60; i++) {
            assertEquals(200, post("/api/reacciones", "Bearer admin-token").getStatus());
        }
        assertEquals(429, post("/api/reacciones", "Bearer admin-token").getStatus());
    }

    @Test
    void tokenAdminNoSaltaRateLimitDeAuth() throws Exception {
        // Endurecimiento: el límite de fuerza-bruta sobre credenciales es
        // universal. Ni un token admin válido (ni uno robado) debe evadir el
        // rate-limit de /api/auth/login — si no, una cuenta admin comprometida
        // martillearía credenciales ajenas sin freno.
        Usuario admin = new Usuario("admin", "password", "admin@example.com");
        admin.setRol(Rol.ADMIN);
        when(jwtUtil.validarToken("admin-token")).thenReturn(true);
        when(jwtUtil.extraerUsername("admin-token")).thenReturn("admin");
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        for (int i = 0; i < 10; i++) {
            assertEquals(200, post("/api/auth/login", "Bearer admin-token").getStatus());
        }
        assertEquals(429, post("/api/auth/login", "Bearer admin-token").getStatus());
    }

    private MockHttpServletResponse get(String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setServletPath(path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private MockHttpServletResponse post(String path) throws Exception {
        return post(path, null);
    }

    private MockHttpServletResponse post(String path, String authorization) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setServletPath(path);
        if (authorization != null) {
            request.addHeader("Authorization", authorization);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
