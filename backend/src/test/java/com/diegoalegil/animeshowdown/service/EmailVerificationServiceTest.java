package com.diegoalegil.animeshowdown.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.UUID;

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
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
// TestAsyncConfig: los asserts del email post-commit verifican un spy de
// EmailService cuyos metodos son @Async — con el executor real, verify()
// corre ANTES de que el hilo del pool invoque al spy (flake de timing
// visto en CI). SyncTaskExecutor lo hace determinista.
@Import(TestAsyncConfig.class)
class EmailVerificationServiceTest {

    @Autowired private EmailVerificationService emailVerificationService;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PlatformTransactionManager transactionManager;
    @MockitoSpyBean private EmailService emailService;

    @Test
    void emitirEnviaElEmailConElLinkTrasElCommit() {
        Usuario usuario = guardarUsuario("verif_email");

        emailVerificationService.emitir(usuario);

        verify(emailService).enviarVerificacion(
                eq(usuario.getEmail()), eq(usuario.getUsername()), contains("/verify?token="));
    }

    @Test
    void emitirNoEnviaEmailSiLaTransaccionHaceRollback() {
        Usuario usuario = guardarUsuario("verif_rollback");

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            emailVerificationService.emitir(usuario);
            status.setRollbackOnly();
        });

        verify(emailService, never()).enviarVerificacion(any(), any(), any());
    }

    private Usuario guardarUsuario(String prefijo) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        Usuario usuario = new Usuario(
                prefijo + "_" + id,
                passwordEncoder.encode("clave1234"),
                prefijo + "_" + id + "@example.com");
        // emitir() es no-op para cuentas ya verificadas; el fixture simula el
        // estado real post-registro.
        usuario.setEstadoVerificacion(EstadoVerificacion.PENDIENTE);
        return usuarioRepository.save(usuario);
    }
}
