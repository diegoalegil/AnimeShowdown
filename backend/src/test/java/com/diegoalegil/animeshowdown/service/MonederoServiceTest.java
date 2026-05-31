package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;
import com.diegoalegil.animeshowdown.repository.MonederoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Tests para MonederoService.
 *
 * <p>El fix de R3-3 (lost-update en acreditar) usa {@code findForUpdateByUsuarioId}
 * (PESSIMISTIC_WRITE lock) antes del read-modify-write del saldo. El test
 * {@code acreditarUsaFinderConLockParaMonederoExistente} verifica con Mockito
 * que acreditar invoca el finder con lock y nunca el finder sin lock.
 *
 * <p>El test {@code mismaReferenciaSoloSeAcreditaUnaVez} verifica idempotencia
 * por (motivo, referencia) — la defensa en BD (UNIQUE constraint) + pre-check en
 * service.
 */
@SpringBootTest
@ActiveProfiles("test")
class MonederoServiceTest {

    @Autowired private MonederoService monederoService;
    @SpyBean private MonederoRepository monederoRepo;
    @Autowired private MonederoMovimientoRepository movimientoRepo;
    @SpyBean private UsuarioRepository usuarioRepo;

    @BeforeEach
    void limpiar() {
        // No se borran usuarios con deleteAll: otros tests del suite dejan
        // filas en duelos_live/votos que referencian usuarios (FK), y un
        // deleteAll global rompe con violación de integridad referencial
        // (fk_duelos_live_jugador1). Cada test crea sus propios usuarios con
        // username único; movimientos y monederos sí se limpian (sin FK entrante).
        movimientoRepo.deleteAll();
        monederoRepo.deleteAll();
    }

    /**
     * Verifica que acreditar PARA UN MONEDERO EXISTENTE llama a
     * {@code findForUpdateByUsuarioId} (el finder con {@code @Lock PESSIMISTIC_WRITE})
     * y NUNCA a {@code findByUsuarioId} (el finder sin lock).
     *
     * Este test demuestra la estructura del fix en CI: el camino con lock es
     * el que se toma cuando el monedero ya existe. En H2 el lock no previene
     * lost-update por la semántica de su motor, pero la estructura del codigo
     * (finder con lock → read-modify-write → flush) es correcta para PostgreSQL.
     */
    @Test
    void acreditarUsaFinderConLockParaMonederoExistente() {
        Usuario usuario = crearUsuario("lock_test");
        monederoService.crearMonederoParaTest(usuario);

        monederoService.acreditar(usuario, MotivoMovimiento.DROP_VOTO, "ref:lock:1", 10L);

        verify(monederoRepo).findForUpdateByUsuarioId(usuario.getId());
        verify(monederoRepo, never()).findByUsuarioId(usuario.getId());
        verify(usuarioRepo, never()).findForUpdateById(usuario.getId());
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(10L);
    }

    /**
     * Verifica que acreditar para un usuario SIN monedero crea el monedero
     * directamente (no intenta crear dos veces — la colision de creacion
     * esta fuera del alcance de R3-3).
     */
    @Test
    void acreditarParaUsuarioSinMonederoCreaMonederoYCredita() {
        Usuario usuario = crearUsuario("nocreate_test");

        // Sin pre-crear: acreditar debe crear el monedero e incrementar saldo.
        // Si la race condition de creacion ocurre (dos INSERT simultaneos),
        // el segundo recibe DataIntegrityViolationException y devuelve el
        // existente sin marcar la tx del llamador como rollback.
        MonederoService.ResultadoCredito resultado = monederoService.acreditar(
                usuario, MotivoMovimiento.DROP_VOTO, "ref:nocreate:1", 25L);

        assertThat(resultado.aplicado()).isTrue();
        assertThat(resultado.saldo()).isEqualTo(25L);
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(25L);
        verify(usuarioRepo).findForUpdateById(usuario.getId());
    }

    /**
     * Idempotencia: dos acreditaciones identicas con la misma referencia
     * deben creditr SOLO una vez. El UNIQUE(motivo, referencia) es la defensa
     * en BD; el pre-check en service es optimizacion de lectura.
     */
    @Test
    void mismaReferenciaSoloSeAcreditaUnaVez() {
        Usuario usuario = crearUsuario("idem_test");
        String ref = "voto:idem:1";

        MonederoService.ResultadoCredito r1 = monederoService.acreditar(
                usuario, MotivoMovimiento.DROP_VOTO, ref, 5L);
        MonederoService.ResultadoCredito r2 = monederoService.acreditar(
                usuario, MotivoMovimiento.DROP_VOTO, ref, 5L);

        assertThat(r1.aplicado()).isTrue();
        assertThat(r2.aplicado()).isFalse();
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(5L);
        assertThat(movimientoRepo.count()).isEqualTo(1L);
    }

    /**
     * Dos referencias distintas para el mismo usuario deben acreditarse
     * ambas (no hay deduplicacion cruzada).
     */
    @Test
    void referenciasDistintasSeAcreditan() {
        Usuario usuario = crearUsuario("multi_ref_test");

        MonederoService.ResultadoCredito r1 = monederoService.acreditar(
                usuario, MotivoMovimiento.DROP_VOTO, "ref:multi:1", 7L);
        MonederoService.ResultadoCredito r2 = monederoService.acreditar(
                usuario, MotivoMovimiento.DROP_VOTO, "ref:multi:2", 13L);

        assertThat(r1.aplicado()).isTrue();
        assertThat(r2.aplicado()).isTrue();
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(20L);
    }

    private Usuario crearUsuario(String username) {
        Usuario u = new Usuario(username, "{noop}secreta123", username + "@test.com");
        u.setEloPvp(1000);
        return usuarioRepo.save(u);
    }
}
