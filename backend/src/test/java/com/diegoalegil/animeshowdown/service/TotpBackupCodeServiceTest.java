package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.TotpBackupCodeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
class TotpBackupCodeServiceTest {

    @Autowired private TotpBackupCodeService backupCodeService;
    @Autowired private TotpBackupCodeRepository backupCodeRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    void consumirSiCoincideSoloPermiteUnUsoConcurrente() throws Exception {
        Usuario usuario = guardarUsuario();
        String codigo = backupCodeService.regenerar(usuario).get(0);
        int intentos = 8;
        CountDownLatch salida = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(intentos);
        try {
            List<Future<Boolean>> resultados = new ArrayList<>();
            Callable<Boolean> consumo = () -> {
                salida.await();
                return backupCodeService.consumirSiCoincide(usuario, codigo);
            };
            for (int i = 0; i < intentos; i++) {
                resultados.add(pool.submit(consumo));
            }

            salida.countDown();

            long exitos = 0;
            for (Future<Boolean> resultado : resultados) {
                if (resultado.get()) {
                    exitos++;
                }
            }
            Usuario recargado = usuarioRepository.findById(usuario.getId()).orElseThrow();
            long usados = backupCodeRepository.findByUsuario(recargado).stream()
                    .filter(c -> c.getUsadoEn() != null)
                    .count();
            assertThat(exitos).isEqualTo(1);
            assertThat(usados).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    private Usuario guardarUsuario() {
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        return usuarioRepository.save(new Usuario(
                "totp_backup_" + sufijo,
                passwordEncoder.encode("secreta123"),
                "totp_backup_" + sufijo + "@example.com"));
    }
}
