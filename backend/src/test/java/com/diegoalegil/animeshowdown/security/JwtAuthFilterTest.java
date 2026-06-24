package com.diegoalegil.animeshowdown.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Contrato de JwtAuthFilter, sin cobertura previa. El invariante crítico es la
 * REVOCACIÓN por token_version: un JWT cuya versión no coincide con la del
 * usuario (porque se hizo logout/cambio de password) debe rechazarse con 401 y
 * NO continuar la cadena. Sin test, un cambio futuro en JwtUtil o Usuario podría
 * romper la invalidación de sesiones silenciosamente.
 */
class JwtAuthFilterTest {

    private JwtUtil jwtUtil;
    private UsuarioRepository usuarioRepository;
    private JwtAuthFilter filter;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        jwtUtil = mock(JwtUtil.class);
        usuarioRepository = mock(UsuarioRepository.class);
        filter = new JwtAuthFilter(jwtUtil, usuarioRepository);
        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        chain = mock(FilterChain.class);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // Usuario REAL: getTokenVersion()/getRol() de la entidad no son stubbeables
    // con mock (getters de Lombok). tokenVersion arranca en 0; variamos la
    // versión del JWT para simular coincidencia (0) o revocación (≠0).
    private Usuario usuarioReal() {
        Usuario u = new Usuario("ana", "pw", "ana@example.com");
        u.setRol(Rol.USER);
        return u;
    }

    private void conBearer(String token) {
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
    }

    @Test
    void tokenValidoConVersionCoincidenteAutenticaYContinua() throws Exception {
        conBearer("tok");
        when(jwtUtil.validarToken("tok")).thenReturn(true);
        when(jwtUtil.extraerUsername("tok")).thenReturn("ana");
        when(jwtUtil.extraerTokenVersion("tok")).thenReturn(0); // coincide con la versión 0 del usuario
        when(usuarioRepository.findByUsername("ana")).thenReturn(Optional.of(usuarioReal()));

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }

    @Test
    void tokenConVersionDesajustadaSeRechazaCon401YNoContinua() throws Exception {
        // JWT con versión 3 pero el usuario fue revocado (versión 4) → 401.
        conBearer("tok");
        when(jwtUtil.validarToken("tok")).thenReturn(true);
        when(jwtUtil.extraerUsername("tok")).thenReturn("ana");
        when(jwtUtil.extraerTokenVersion("tok")).thenReturn(1); // ≠ versión 0 del usuario → revocado
        when(usuarioRepository.findByUsername("ana")).thenReturn(Optional.of(usuarioReal()));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void usuarioFantasmaDelJwtNoAutenticaPeroContinuaSin500() throws Exception {
        // JWT válido pero el usuario ya no existe en BD: no autentica, pero NO
        // revienta — deja pasar como anónimo.
        conBearer("tok");
        when(jwtUtil.validarToken("tok")).thenReturn(true);
        when(jwtUtil.extraerUsername("tok")).thenReturn("fantasma");
        when(usuarioRepository.findByUsername("fantasma")).thenReturn(Optional.empty());

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void sinHeaderAuthorizationContinuaComoAnonimo() throws Exception {
        when(request.getHeader("Authorization")).thenReturn(null);

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenInvalidoContinuaComoAnonimo() throws Exception {
        conBearer("malo");
        when(jwtUtil.validarToken("malo")).thenReturn(false);

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }
}
