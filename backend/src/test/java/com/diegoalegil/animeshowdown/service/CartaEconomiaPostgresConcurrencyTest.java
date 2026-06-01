package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.AbrirSobreResultadoDto;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.MonederoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaPityRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.support.PostgresIntegrationTestBase;

import jakarta.persistence.EntityManager;

@SpringBootTest(properties = {
        "app.cartas.duplicado.recompensa=0",
        "app.cartas.especial.probabilidad-base=0"
})
@ActiveProfiles("test")
class CartaEconomiaPostgresConcurrencyTest extends PostgresIntegrationTestBase {

    @Autowired private CartaService cartaService;
    @Autowired private MonederoService monederoService;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private MonederoRepository monederoRepository;
    @Autowired private UsuarioCartaPityRepository pityRepository;
    @Autowired private EntityManager entityManager;

    @Test
    void dosAperturasConcurrentesConMismaKeySoloDebitanUnaVez() throws Exception {
        Usuario usuario = crearUsuario("cartas_pg_same");
        monederoService.acreditar(usuario, MotivoMovimiento.DROP_VOTO, "seed:cartas_pg_same", 100L);

        List<AbrirSobreResultadoDto> resultados = abrirConcurrente(
                usuario.getId(),
                List.of("pack-idem-pg", "pack-idem-pg"));

        assertThat(resultados).hasSize(2);
        assertThat(resultados).allSatisfy(resultado -> {
            assertThat(resultado.precio()).isEqualTo(100L);
            assertThat(resultado.cartas()).hasSize(5);
        });
        assertThat(aperturas(usuario)).isEqualTo(1L);
        assertThat(itemsDeAperturas(usuario)).isEqualTo(5L);
        assertThat(movimientos(usuario, MotivoMovimiento.COMPRA_SOBRE)).isEqualTo(1L);
        assertThat(monederoRepository.findByUsuarioId(usuario.getId()).orElseThrow().getSaldo()).isZero();
        assertThat(pityRepository.findById(usuario.getId()).orElseThrow().getSobresSinEspecial()).isEqualTo(1);
    }

    @Test
    void dosAperturasConcurrentesConKeysDistintasSerializanSaldoYPity() throws Exception {
        Usuario usuario = crearUsuario("cartas_pg_distintas");
        monederoService.acreditar(usuario, MotivoMovimiento.DROP_VOTO, "seed:cartas_pg_distintas", 200L);

        List<AbrirSobreResultadoDto> resultados = abrirConcurrente(
                usuario.getId(),
                List.of("pack-pg-1", "pack-pg-2"));

        assertThat(resultados).hasSize(2);
        assertThat(resultados).allSatisfy(resultado -> {
            assertThat(resultado.precio()).isEqualTo(100L);
            assertThat(resultado.cartas()).hasSize(5);
        });
        assertThat(aperturas(usuario)).isEqualTo(2L);
        assertThat(itemsDeAperturas(usuario)).isEqualTo(10L);
        assertThat(movimientos(usuario, MotivoMovimiento.COMPRA_SOBRE)).isEqualTo(2L);
        assertThat(monederoRepository.findByUsuarioId(usuario.getId()).orElseThrow().getSaldo()).isZero();
        assertThat(pityRepository.findById(usuario.getId()).orElseThrow().getSobresSinEspecial()).isEqualTo(2);
    }

    private Usuario crearUsuario(String username) {
        Usuario usuario = new Usuario(username, "{noop}pass", username + "@example.test");
        return usuarioRepository.saveAndFlush(usuario);
    }

    private List<AbrirSobreResultadoDto> abrirConcurrente(Long usuarioId, List<String> keys) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(keys.size());
        try {
            List<Future<AbrirSobreResultadoDto>> futures = new ArrayList<>();
            for (String key : keys) {
                futures.add(executor.submit(abrirCuandoArranque(usuarioId, key, start)));
            }
            start.countDown();

            List<AbrirSobreResultadoDto> resultados = new ArrayList<>();
            for (Future<AbrirSobreResultadoDto> future : futures) {
                resultados.add(future.get(10, TimeUnit.SECONDS));
            }
            return resultados;
        } finally {
            executor.shutdownNow();
        }
    }

    private Callable<AbrirSobreResultadoDto> abrirCuandoArranque(
            Long usuarioId,
            String key,
            CountDownLatch start) {
        return () -> {
            assertThat(start.await(3, TimeUnit.SECONDS)).isTrue();
            Usuario usuario = usuarioRepository.findById(usuarioId).orElseThrow();
            return cartaService.abrirSobre(usuario, key);
        };
    }

    private long aperturas(Usuario usuario) {
        return entityManager.createQuery("""
                select count(apertura)
                from SobreApertura apertura
                where apertura.usuario.id = :usuarioId
                """, Long.class)
                .setParameter("usuarioId", usuario.getId())
                .getSingleResult();
    }

    private long itemsDeAperturas(Usuario usuario) {
        return entityManager.createQuery("""
                select count(item)
                from SobreAperturaItem item
                where item.sobre.usuario.id = :usuarioId
                """, Long.class)
                .setParameter("usuarioId", usuario.getId())
                .getSingleResult();
    }

    private long movimientos(Usuario usuario, MotivoMovimiento motivo) {
        return entityManager.createQuery("""
                select count(movimiento)
                from MonederoMovimiento movimiento
                where movimiento.usuario.id = :usuarioId
                  and movimiento.motivo = :motivo
                """, Long.class)
                .setParameter("usuarioId", usuario.getId())
                .setParameter("motivo", motivo)
                .getSingleResult();
    }
}
