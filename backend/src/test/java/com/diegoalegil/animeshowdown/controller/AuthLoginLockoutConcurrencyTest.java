package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthLoginLockoutConcurrencyTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    void cincoLoginsFallidosConcurrentesBloqueanLaCuenta() throws Exception {
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        String username = "lockout_" + sufijo;
        usuarioRepository.save(new Usuario(
                username,
                passwordEncoder.encode("secreta123"),
                username + "@example.com"));
        int intentos = 5;
        CountDownLatch salida = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(intentos);
        try {
            List<Future<Integer>> resultados = new ArrayList<>();
            Callable<Integer> loginFallido = () -> {
                salida.await();
                return mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "username", username,
                                "password", "incorrecta123"))))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            };
            for (int i = 0; i < intentos; i++) {
                resultados.add(pool.submit(loginFallido));
            }

            salida.countDown();

            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> resultado : resultados) {
                statuses.add(resultado.get());
            }
            Usuario despues = usuarioRepository.findByUsername(username).orElseThrow();
            assertThat(statuses).containsOnly(401);
            assertThat(despues.getIntentosFallidos()).isEqualTo(0);
            assertThat(despues.getBloqueadoHasta()).isAfter(LocalDateTime.now());

            mvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of(
                            "username", username,
                            "password", "secreta123"))))
                    .andExpect(status().isLocked());
        } finally {
            pool.shutdownNow();
        }
    }
}
