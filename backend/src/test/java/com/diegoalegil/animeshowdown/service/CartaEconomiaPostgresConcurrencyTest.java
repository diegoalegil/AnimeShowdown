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
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.MonederoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
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
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private CartaRepository cartaRepository;
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

    @Test
    void concesionesConcurrentesDeMismaCartaNoPierdenIncrementos() throws Exception {
        Usuario usuario = crearUsuario("cartas_pg_concesion");
        String slug = "pg-concesion-heroe";
        Carta carta = crearCartaEspecial(slug);

        // Pre-concesión: la fila usuario+carta ya existe con cantidad=1. Así el
        // test aísla el lost-update del INCREMENTO (no la carrera del primer
        // INSERT, que el UNIQUE resuelve dando conflicto a una de las copias).
        Carta pre = cartaService.concederCartaEspecialPorSlug(usuario, slug);
        assertThat(pre).isNotNull();
        assertThat(cantidadDe(usuario, carta)).isEqualTo(1);

        int concurrentes = 16;
        List<Carta> resultados = concederConcurrente(usuario.getId(), slug, concurrentes);

        assertThat(resultados).hasSize(concurrentes);
        assertThat(resultados).allSatisfy(c -> assertThat(c).isNotNull());
        // Una sola fila de posesión y TODOS los incrementos contabilizados: con el
        // read-modify-write previo se perdían incrementos (cantidad < 1+N).
        assertThat(filasDePosesion(usuario, carta)).isEqualTo(1L);
        assertThat(cantidadDe(usuario, carta)).isEqualTo(1 + concurrentes);
    }

    @Test
    void concesionesConcurrentesDeCartaNuevaNoRevientan() throws Exception {
        // Primera posesión EN CARRERA: varias concesiones concurrentes de la
        // MISMA carta nueva SIN pre-concesión. Antes la 2ª+ copia chocaba con el
        // UNIQUE uk_usuario_carta -> DataIntegrityViolationException (500) que
        // envenenaba la tx de concesión/apertura. Con el INSERT ... ON CONFLICT
        // DO NOTHING ninguna revienta: una crea la fila (NUEVA) y el resto la
        // incrementan (duplicado), sin lost-update.
        Usuario usuario = crearUsuario("cartas_pg_primera");
        String slug = "pg-primera-heroe";
        Carta carta = crearCartaEspecial(slug);

        int concurrentes = 16;
        List<Carta> resultados = concederConcurrente(usuario.getId(), slug, concurrentes);

        assertThat(resultados).hasSize(concurrentes);
        assertThat(resultados).allSatisfy(c -> assertThat(c).isNotNull()); // ninguna 500
        // Una sola fila de posesión y cantidad = N (1 nueva + N-1 duplicados):
        // sin el UPSERT, una de las copias reventaba la transacción.
        assertThat(filasDePosesion(usuario, carta)).isEqualTo(1L);
        assertThat(cantidadDe(usuario, carta)).isEqualTo(concurrentes);
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

    private Carta crearCartaEspecial(String slug) {
        Personaje personaje = new Personaje(slug, "Heroe " + slug, "Anime Test", "desc", null);
        personajeRepository.saveAndFlush(personaje);
        return cartaRepository.saveAndFlush(new Carta(personaje, RarezaCarta.ESPECIAL));
    }

    private List<Carta> concederConcurrente(Long usuarioId, String slug, int veces) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(veces);
        try {
            List<Future<Carta>> futures = new ArrayList<>();
            for (int i = 0; i < veces; i++) {
                futures.add(executor.submit(() -> {
                    assertThat(start.await(3, TimeUnit.SECONDS)).isTrue();
                    Usuario usuario = usuarioRepository.findById(usuarioId).orElseThrow();
                    return cartaService.concederCartaEspecialPorSlug(usuario, slug);
                }));
            }
            start.countDown();

            List<Carta> resultados = new ArrayList<>();
            for (Future<Carta> future : futures) {
                resultados.add(future.get(15, TimeUnit.SECONDS));
            }
            return resultados;
        } finally {
            executor.shutdownNow();
        }
    }

    private long filasDePosesion(Usuario usuario, Carta carta) {
        return entityManager.createQuery("""
                select count(uc)
                from UsuarioCarta uc
                where uc.usuario.id = :usuarioId and uc.carta.id = :cartaId
                """, Long.class)
                .setParameter("usuarioId", usuario.getId())
                .setParameter("cartaId", carta.getId())
                .getSingleResult();
    }

    private int cantidadDe(Usuario usuario, Carta carta) {
        return entityManager.createQuery("""
                select uc.cantidad
                from UsuarioCarta uc
                where uc.usuario.id = :usuarioId and uc.carta.id = :cartaId
                """, Integer.class)
                .setParameter("usuarioId", usuario.getId())
                .setParameter("cartaId", carta.getId())
                .getSingleResult();
    }
}
