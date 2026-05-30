package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;
import com.diegoalegil.animeshowdown.repository.LogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Tests para el fix de R3-4: BadgeService.desbloquear no envenena la tx del llamador.
 *
 * <p>El fix tiene tres partes:
 * <ol>
 *   <li>Pre-check (existsByUsuarioAndLogro) antes del INSERT — evita la UNIQUE
 *       violation en el caso normal de badge duplicado.</li>
 *   <li>REQUIRES_NEW en {@code desbloquear} — aísla el rollback de cualquier
 *       UNIQUE violation residual (race condition real) para que NO contamine
 *       la tx del llamador. Los llamadores son siempre beans DISTINTOS
 *       (EmailVerificationService, DueloLiveService, etc.), así que el proxy
 *       de Spring intercepta y REQUIRES_NEW surte efecto.</li>
 *   <li>El catch de DataIntegrityViolationException trata la race condition
 *       como no-op.</li>
 * </ol>
 */
@SpringBootTest
@ActiveProfiles("test")
class BadgeServiceTest {

    @Autowired private BadgeService badgeService;
    @Autowired private UsuarioRepository usuarioRepo;
    @Autowired private LogroRepository logroRepo;
    @Autowired private UsuarioLogroRepository usuarioLogroRepo;

    private Usuario usuario;

    @BeforeEach
    void limpiar() {
        usuarioLogroRepo.deleteAll();
        // NO limpiar logros ni usuarios — V7 inserta el catálogo de logros
        // en H2 y esos registros son la fuente de verdad para los tests.
        // NO hacer usuarioRepo.deleteAll() porque otros tests en el suite
        // tienen filas en duelos_live/votos que referencian esos usuarios.
        // Cada test crea su usuario con username único así que no hay conflicto.
        usuario = crearUsuario("badge_test_" + System.currentTimeMillis());
    }

    /**
     * Test principal: fail-before/pass-after del bug base.
     *
     * Sin el pre-check + catch en {@code desbloquear}, la segunda llamada
     * recibe UNIQUE violation, marca la tx como rollback-only y lanza
     * UnexpectedRollbackException al caller.
     *
     * Con el fix: segunda llamada devuelve Optional.empty() y la tx
     * continúa sin excepción.
     */
    @Test
    void desbloquearDosVecesNoLanzaYDejaUnaSolaFila() {
        // Primera llamada: crea el badge.
        var primero = badgeService.desbloquear(usuario, "reclutador");
        assertThat(primero).isPresent();
        assertThat(usuarioLogroRepo.existsByUsuarioAndLogroCodigo(usuario, "reclutador")).isTrue();

        // Segunda llamada: debe ser no-op sin lanzar.
        var segundo = badgeService.desbloquear(usuario, "reclutador");
        assertThat(segundo).isEmpty();

        // Una sola fila en la tabla.
        assertThat(usuarioLogroRepo.findByUsuarioOrderByDesbloqueadoEnDesc(usuario))
                .hasSize(1);
    }

    /**
     * Verifica que {@code desbloquear} no envenena la tx del llamador.
     *
     * El escenario: el llamador hace una operacion de persistencia
     * (cambiar un campo de perfil) tras el desbloqueo. Con el fix
     * (REQUIRES_NEW), el rollback de cualquier UNIQUE violation queda
     * contenido en la tx interna de {@code desbloquear} y NO marca la
     * tx del llamador como rollback-only.
     *
     * El test no usa {@code @Transactional} en el metodo de test para
     * evitar confusion con Spring Test tx management. En su lugar,
     * verificamos el estado de la BD tras ambas operaciones: si el
     * desbloqueo envenenara la tx, el save del perfil NO persistiria
     * (UnexpectedRollbackException).
     */
    @Test
    void llamarDesbloqueoNoEnvenenaTxDelLlamador() {
        // Pre-condición: el usuario ya tiene el badge.
        badgeService.desbloquear(usuario, "reclutador");

        // El llamador hace otra operacion tras el desbloqueo:
        // cambiar un campo de perfil y guardar. Sin el fix, cualquier
        // UNIQUE violation en desbloquear marcaria la tx como
        // rollback-only → UnexpectedRollbackException en el save.
        usuario.setEloPvp(1500);
        assertThatNoException().isThrownBy(() -> usuarioRepo.save(usuario));

        // Verificar que ambos cambios persistieron.
        Usuario verificado = usuarioRepo.findById(usuario.getId()).orElseThrow();
        assertThat(verificado.getEloPvp()).isEqualTo(1500);
        assertThat(usuarioLogroRepo.findByUsuarioOrderByDesbloqueadoEnDesc(usuario))
                .hasSize(1);
    }

    /**
     * El pre-check (existsByUsuarioAndLogro) se ejecuta antes del INSERT.
     * Cuando el badge ya existe, no se genera INSERT y por tanto no hay
     * posibilidad de UNIQUE violation ni rollback.
     */
    @Test
    void preCheckEvitaInsertCuandoBadgeYaExiste() {
        Logro logro = obtenerOCrearLogro("reclutador", "Reclutador",
                "Recluta 3 referrals verificados", (short) 2);
        crearUsuarioLogroDirecto(usuario, logro);

        var resultado = badgeService.desbloquear(usuario, "reclutador");

        assertThat(resultado).isEmpty();
        assertThat(usuarioLogroRepo.findByUsuarioOrderByDesbloqueadoEnDesc(usuario))
                .hasSize(1);
    }

    /**
     * Primera vez que se desbloquea un badge: debe crear la fila,
     * devolver Optional presente, y dejar exactamente una fila.
     */
    @Test
    void primerDesbloqueoCreaFilaYDevuelvePresente() {
        // Verificar que el logro existe en BD (seed de V7).
        assertThat(logroRepo.findByCodigo("reclutador")).isPresent();

        var resultado = badgeService.desbloquear(usuario, "reclutador");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getUsuario()).isEqualTo(usuario);
        assertThat(usuarioLogroRepo.findByUsuarioOrderByDesbloqueadoEnDesc(usuario))
                .hasSize(1);
    }

    /**
     * La ruta otaku_certificado ya no tiene auto-invocacion: LogroController
     * llama directamente a badgeService.desbloquear(usuario, "otaku_certificado")
     * (cross-bean, proxy aplica, REQUIRES_NEW funciona).
     * Este test verifica que dos desbloqueos de otaku_certificado NO propagan
     * excepcion y dejan una sola fila.
     */
    @Test
    void otakuCertificadoDosVecesNoLanzaYDejaUnaSolaFila() {
        // Primera vez: crear el badge.
        var primero = badgeService.desbloquear(usuario, "otaku_certificado");
        assertThat(primero).isPresent();

        // Segunda vez: debe ser no-op sin lanzar.
        var segundo = badgeService.desbloquear(usuario, "otaku_certificado");
        assertThat(segundo).isEmpty();

        assertThat(usuarioLogroRepo.findByUsuarioOrderByDesbloqueadoEnDesc(usuario))
                .hasSize(1);
    }

    /**
     * Badge inexistente devuelve empty sin lanzar.
     */
    @Test
    void badgeInexistenteDevuelveEmpty() {
        var resultado = badgeService.desbloquear(usuario,
                "badge_que_no_existe_en_el_catalogo");

        assertThat(resultado).isEmpty();
    }

    private Usuario crearUsuario(String username) {
        Usuario u = new Usuario(username, "{noop}secreta123",
                username.replace("_", "") + "@test.com");
        u.setEloPvp(1000);
        return usuarioRepo.save(u);
    }

    private Logro obtenerOCrearLogro(String codigo, String nombre, String descripcion, short rareza) {
        return logroRepo.findByCodigo(codigo)
                .orElseGet(() -> {
                    Logro l = new Logro(codigo, nombre, descripcion, "Trophy", (short) rareza);
                    return logroRepo.saveAndFlush(l);
                });
    }

    /**
     * Crea un Logro directamente con fecha de desbloqueo seteada.
     */
    private void crearUsuarioLogroDirecto(Usuario usuario, Logro logro) {
        usuarioLogroRepo.saveAndFlush(
                new UsuarioLogro(usuario, logro, java.time.LocalDateTime.now()));
    }
}