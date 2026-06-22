package com.diegoalegil.animeshowdown.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
class OAuthAccountServiceTest {

    @Autowired private OAuthAccountService oauthAccountService;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private UsuarioLogroRepository usuarioLogroRepository;

    @Test
    void googleNuevoUsuarioNaceActivoConUsernameDerivado() {
        String id = UUID.randomUUID().toString().substring(0, 8);
        var result = oauthAccountService.resolverOCrear("google", Map.of(
                "email", "Fan." + id + "@Example.com",
                "email_verified", true,
                "picture", "https://example.com/avatar.png"));

        assertTrue(result.creado());
        assertEquals("fan_" + id, result.usuario().getUsername());
        assertEquals("fan." + id + "@example.com", result.usuario().getEmail());
        assertEquals(EstadoVerificacion.ACTIVO, result.usuario().getEstadoVerificacion());
        assertEquals(Rol.USER, result.usuario().getRol());
        assertEquals("https://example.com/avatar.png", result.usuario().getAvatarUrl());
        assertNotNull(result.usuario().getReferralCode());
        assertTrue(usuarioLogroRepository.existsByUsuarioAndLogroCodigo(result.usuario(), "fundador"));
        // V-8: el username es autogenerado, así que la cuenta nace pendiente
        // de onboarding (el frontend mostrará el modal una vez).
        assertFalse(result.usuario().isOnboardingCompletado());
    }

    @Test
    void emailExistenteLinkeaSinCrearDuplicado() {
        String id = UUID.randomUUID().toString().substring(0, 8);
        Usuario existente = new Usuario("oauth_link_" + id, "hash", "oauth_link_" + id + "@example.com");
        usuarioRepository.save(existente);
        long antes = usuarioRepository.count();

        var result = oauthAccountService.resolverOCrear("discord", Map.of(
                "id", "123",
                "email", existente.getEmail(),
                "verified", true));

        assertFalse(result.creado());
        assertEquals(existente.getId(), result.usuario().getId());
        assertEquals(antes, usuarioRepository.count());
    }

    @Test
    void usernameColisionadoRecibeSufijo() {
        String id = UUID.randomUUID().toString().substring(0, 8);
        usuarioRepository.save(new Usuario("duelist_" + id, "hash", "duelist_" + id + "@old.example"));

        var result = oauthAccountService.resolverOCrear("google", Map.of(
                "email", "duelist_" + id + "@example.com",
                "email_verified", true));

        assertTrue(result.creado());
        assertEquals("duelist_" + id + "_2", result.usuario().getUsername());
    }

    @Test
    void primerLoginOAuthConcurrenteNoDuplicaNiRevienta() throws Exception {
        // Carrera: varios primeros logins OAuth del mismo email nuevo a la vez.
        // El fix (crear en REQUIRES_NEW + capturar el choque del UNIQUE + re-leer)
        // debe hacer que TODOS resuelvan al mismo usuario, sin 500 ni duplicado.
        // f.get() relanza cualquier excepción de un hilo → el test solo falla si
        // el fix está roto (un DIV escapa), nunca por timing.
        String id = UUID.randomUUID().toString().substring(0, 8);
        String email = "race_" + id + "@example.com";
        Map<String, Object> attrs = Map.of("email", email, "email_verified", true);
        int hilos = 8;
        CountDownLatch salida = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(hilos);
        try {
            List<Future<Long>> futuros = new ArrayList<>();
            for (int i = 0; i < hilos; i++) {
                futuros.add(pool.submit(() -> {
                    salida.await();
                    return oauthAccountService.resolverOCrear("google", attrs).usuario().getId();
                }));
            }
            salida.countDown();

            List<Long> ids = new ArrayList<>();
            for (Future<Long> f : futuros) {
                ids.add(f.get());
            }
            long primerId = ids.get(0);
            for (Long uid : ids) {
                assertEquals(primerId, uid);
            }
            assertTrue(usuarioRepository.findByEmail(email).isPresent());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void emailNoVerificadoSeRechaza() {
        assertThrows(IllegalArgumentException.class, () ->
                oauthAccountService.resolverOCrear("google", Map.of(
                        "email", "oauth_unverified@example.com",
                        "email_verified", false)));
    }
}
