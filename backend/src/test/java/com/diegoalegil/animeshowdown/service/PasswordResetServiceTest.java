package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.matches;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.diegoalegil.animeshowdown.TestAsyncConfig;
import com.diegoalegil.animeshowdown.model.PasswordResetToken;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PasswordResetTokenRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
// TestAsyncConfig solo sustituye el TaskExecutor POR DEFECTO; los emails
// usan @Async("emailExecutor") — un bean RESUELTO POR NOMBRE al que el
// @Primary del test-config NO alcanza, así que el envío corre igualmente
// en el pool real. Por eso los verify() positivos del email llevan
// timeout(): esperan a que el hilo del pool invoque al spy (flake real
// visto en CI: "zero interactions"). El import se queda para el resto de
// @Async sin nombre del flujo (audit log, etc.).
@Import(TestAsyncConfig.class)
class PasswordResetServiceTest {

    @Autowired private PasswordResetService passwordResetService;
    @Autowired private PasswordResetTokenRepository tokenRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PlatformTransactionManager transactionManager;
    @MockitoSpyBean private EmailService emailService;

    @Test
    void solicitarResetNoPersisteCodigoEnClaro() {
        Usuario usuario = guardarUsuario("reset_hash");

        passwordResetService.solicitarReset(usuario.getEmail());

        PasswordResetToken token = tokenRepository
                .findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(usuario.getId())
                .orElseThrow();
        assertThat(token.getCodigo()).isEqualTo(PasswordResetToken.CODIGO_REDACTADO);
        assertThat(token.getCodigoHash()).isNotBlank();
        assertThat(token.getCodigoHash()).doesNotMatch("\\d{6}");
    }

    @Test
    void solicitarResetEnviaElEmailTrasElCommit() {
        Usuario usuario = guardarUsuario("reset_email");

        passwordResetService.solicitarReset(usuario.getEmail());

        verify(emailService, timeout(5000)).enviarCodigoReset(
                eq(usuario.getEmail()), eq(usuario.getUsername()), matches("\\d{6}"));
    }

    @Test
    void solicitarResetNoEnviaEmailSiLaTransaccionHaceRollback() {
        Usuario usuario = guardarUsuario("reset_rollback");

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            passwordResetService.solicitarReset(usuario.getEmail());
            status.setRollbackOnly();
        });

        verify(emailService, never()).enviarCodigoReset(any(), any(), any());
    }

    @Test
    void resetearPasswordConsumeTokenUnaSolaVez() {
        Usuario usuario = guardarUsuario("reset_once");
        PasswordResetToken token = guardarToken(usuario, "123456");

        passwordResetService.resetearPassword(usuario.getEmail(), "123456", "nueva1234");

        Usuario actualizado = usuarioRepository.findById(usuario.getId()).orElseThrow();
        PasswordResetToken consumido = tokenRepository.findById(token.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("nueva1234", actualizado.getPassword())).isTrue();
        assertThat(consumido.isUsado()).isTrue();
        assertThat(consumido.getUsadoEn()).isNotNull();

        assertThrows(IllegalArgumentException.class,
                () -> passwordResetService.resetearPassword(usuario.getEmail(), "123456", "otra1234"));
        Usuario trasSegundoIntento = usuarioRepository.findById(usuario.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("nueva1234", trasSegundoIntento.getPassword())).isTrue();
    }

    @Test
    void resetearPasswordSoloPermiteUnConsumoConcurrente() throws Exception {
        Usuario usuario = guardarUsuario("reset_race");
        guardarToken(usuario, "654321");
        CountDownLatch salida = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> intento = () -> {
                salida.await();
                try {
                    passwordResetService.resetearPassword(usuario.getEmail(), "654321", "race1234");
                    return true;
                } catch (IllegalArgumentException ex) {
                    return false;
                }
            };
            var primero = pool.submit(intento);
            var segundo = pool.submit(intento);

            salida.countDown();

            List<Boolean> resultados = List.of(primero.get(), segundo.get());
            assertThat(resultados).containsExactlyInAnyOrder(true, false);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void codigoIncorrectoIncrementaIntentosYBloqueaElToken() {
        Usuario usuario = guardarUsuario("reset_attempts");
        PasswordResetToken token = guardarToken(usuario, "111111");

        for (int i = 0; i < 5; i++) {
            assertThrows(IllegalArgumentException.class,
                    () -> passwordResetService.resetearPassword(usuario.getEmail(), "222222", "nueva1234"));
        }

        PasswordResetToken bloqueado = tokenRepository.findById(token.getId()).orElseThrow();
        assertThat(bloqueado.getIntentosFallidos()).isEqualTo(5);
        assertThat(bloqueado.isUsado()).isTrue();
        assertThat(bloqueado.getUsadoEn()).isNotNull();
    }

    private Usuario guardarUsuario(String prefijo) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        return usuarioRepository.save(new Usuario(
                prefijo + "_" + id,
                passwordEncoder.encode("vieja1234"),
                prefijo + "_" + id + "@example.com"));
    }

    private PasswordResetToken guardarToken(Usuario usuario, String codigo) {
        PasswordResetToken token = new PasswordResetToken(
                usuario.getId(),
                passwordEncoder.encode(codigo),
                LocalDateTime.now().plusMinutes(15));
        return tokenRepository.saveAndFlush(token);
    }
}
