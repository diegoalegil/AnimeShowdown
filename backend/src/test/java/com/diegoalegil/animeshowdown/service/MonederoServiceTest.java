package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

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
 * por (motivo, referencia) — re-chequeo DENTRO del lock del monedero + UNIQUE
 * constraint como red final. {@code idempotenciaSeChequeaDentroDelLockDeMonedero}
 * fija ese orden (lock antes del chequeo) contra regresiones.
 */
@SpringBootTest
@ActiveProfiles("test")
class MonederoServiceTest {

    @Autowired private MonederoService monederoService;
    @SpyBean private MonederoRepository monederoRepo;
    @SpyBean private MonederoMovimientoRepository movimientoRepo;
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
     * deben creditr SOLO una vez. El re-chequeo dentro del lock devuelve
     * {@code aplicado=false} en la repetición; el UNIQUE(motivo, referencia) es
     * la red final en BD.
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

    @Test
    void topeDiarioSoloCuentaMotivosDrop() {
        Usuario usuario = crearUsuario("drop_motivos_test");
        LocalDateTime desde = LocalDateTime.now().minusDays(1);

        monederoService.acreditar(usuario, MotivoMovimiento.COFRE_DIARIO, "cofre:drop-motivos", 50L);
        monederoService.acreditar(usuario, MotivoMovimiento.DUPLICADO_CARTA, "duplicado:drop-motivos", 10L);

        MonederoService.ResultadoDrop primerDrop = monederoService.acreditarDropConTopeDiario(
                usuario, MotivoMovimiento.DROP_VOTO, "drop:motivos:1", 5L, 1, desde);
        MonederoService.ResultadoDrop segundoDrop = monederoService.acreditarDropConTopeDiario(
                usuario, MotivoMovimiento.DROP_DUELO, "drop:motivos:2", 20L, 1, desde);

        assertThat(primerDrop.estado()).isEqualTo(MonederoService.ResultadoDrop.Estado.APLICADO);
        assertThat(segundoDrop.estado()).isEqualTo(MonederoService.ResultadoDrop.Estado.TOPE_DIARIO);
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(65L);
    }

    @Test
    void elDropDeJuegoEloDuelCuentaParaElTopeDiario() {
        // Regresión: DROP_JUEGO (ELO Duel) debe contar para el tope diario como
        // el resto de drops. Si MOTIVOS_DROP no lo incluye, sería un faucet de
        // moneda sin límite (farmeo ilimitado). Con tope=1: el 1er acierto
        // acredita, el 2º cae al tope.
        Usuario usuario = crearUsuario("drop_juego_tope");
        LocalDateTime desde = LocalDateTime.now().minusDays(1);

        MonederoService.ResultadoDrop primero = monederoService.acreditarDropConTopeDiario(
                usuario, MotivoMovimiento.DROP_JUEGO, "juego:elo:tope:1", 3L, 1, desde);
        MonederoService.ResultadoDrop segundo = monederoService.acreditarDropConTopeDiario(
                usuario, MotivoMovimiento.DROP_JUEGO, "juego:elo:tope:2", 3L, 1, desde);

        assertThat(primero.estado()).isEqualTo(MonederoService.ResultadoDrop.Estado.APLICADO);
        assertThat(segundo.estado()).isEqualTo(MonederoService.ResultadoDrop.Estado.TOPE_DIARIO);
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(3L);
    }

    @Test
    void topeDiarioSeCuentaDentroDelLockDeMonedero() {
        Usuario usuario = crearUsuario("drop_lock_order");
        monederoService.crearMonederoParaTest(usuario);
        clearInvocations(monederoRepo, movimientoRepo);
        LocalDateTime desde = LocalDateTime.now().minusDays(1);

        MonederoService.ResultadoDrop resultado = monederoService.acreditarDropConTopeDiario(
                usuario, MotivoMovimiento.DROP_VOTO, "drop:lock-order:1", 5L, 5, desde);

        assertThat(resultado.estado()).isEqualTo(MonederoService.ResultadoDrop.Estado.APLICADO);
        InOrder inOrder = inOrder(monederoRepo, movimientoRepo);
        inOrder.verify(monederoRepo).findForUpdateByUsuarioId(usuario.getId());
        inOrder.verify(movimientoRepo).countDropsDesde(eq(usuario), any(), eq(desde));
    }

    /**
     * Regresión del fix aborted-tx: el chequeo de idempotencia de {@code acreditar}
     * debe ocurrir DENTRO del lock del monedero — {@code findForUpdateByUsuarioId}
     * ANTES de {@code existsByUsuarioAndMotivoAndReferencia}. Si se hiciera antes de
     * adquirir el lock (como antes), dos créditos concurrentes del mismo
     * (motivo, referencia) pasarían ambos el chequeo, se serializarían en el lock y
     * el segundo intentaría el INSERT igualmente — violando {@code uk_mon_mov_idem}
     * y abortando la tx del llamador en Postgres (cofre diario / recompensa de
     * evento → 500). Mismo blindaje que {@code acreditarDropConTopeDiario}.
     */
    @Test
    void idempotenciaSeChequeaDentroDelLockDeMonedero() {
        Usuario usuario = crearUsuario("idem_lock_order");
        monederoService.crearMonederoParaTest(usuario);
        clearInvocations(monederoRepo, movimientoRepo);

        monederoService.acreditar(usuario, MotivoMovimiento.COFRE_DIARIO, "cofre:idem-lock:1", 7L);

        InOrder inOrder = inOrder(monederoRepo, movimientoRepo);
        inOrder.verify(monederoRepo).findForUpdateByUsuarioId(usuario.getId());
        inOrder.verify(movimientoRepo).existsByUsuarioAndMotivoAndReferencia(
                eq(usuario), eq(MotivoMovimiento.COFRE_DIARIO), eq("cofre:idem-lock:1"));
    }

    @Test
    void debitarReduceElSaldoYRegistraMovimientoNegativo() {
        Usuario usuario = crearUsuario("debitar_ok");
        monederoService.acreditar(usuario, MotivoMovimiento.DROP_VOTO, "fondo:debitar:1", 100L);

        long saldo = monederoService.debitar(usuario, MotivoMovimiento.COMPRA_SOBRE, "compra:1", 30L);

        assertThat(saldo).isEqualTo(70L);
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(70L);
        // Crédito (+100) y débito (-30) registrados como dos movimientos.
        assertThat(movimientoRepo.count()).isEqualTo(2L);
    }

    @Test
    void debitarConSaldoInsuficienteLanza409YNoTocaElSaldo() {
        Usuario usuario = crearUsuario("debitar_insuf");
        monederoService.acreditar(usuario, MotivoMovimiento.DROP_VOTO, "fondo:insuf:1", 50L);

        assertThatThrownBy(() -> monederoService.debitar(
                usuario, MotivoMovimiento.COMPRA_SOBRE, "compra:insuf:1", 100L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));

        // El gasto fallido no debe mover el saldo.
        assertThat(monederoService.saldoDe(usuario)).isEqualTo(50L);
    }

    @Test
    void debitarSinMonederoLanza409() {
        // Sin monedero (sin crédito previo) tampoco hay saldo: 409, no NPE.
        Usuario usuario = crearUsuario("debitar_sinmon");
        assertThatThrownBy(() -> monederoService.debitar(
                usuario, MotivoMovimiento.COMPRA_SOBRE, "compra:sinmon:1", 10L))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void debitarCantidadNoPositivaEsIllegalArgument() {
        Usuario usuario = crearUsuario("debitar_neg");
        monederoService.acreditar(usuario, MotivoMovimiento.DROP_VOTO, "fondo:neg:1", 100L);
        assertThatThrownBy(() -> monederoService.debitar(
                usuario, MotivoMovimiento.COMPRA_SOBRE, "compra:neg:1", 0L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private Usuario crearUsuario(String username) {
        Usuario u = new Usuario(username, "{noop}secreta123", username + "@test.com");
        u.setEloPvp(1000);
        return usuarioRepo.save(u);
    }
}
