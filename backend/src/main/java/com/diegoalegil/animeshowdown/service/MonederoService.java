package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.model.Monedero;
import com.diegoalegil.animeshowdown.model.MonederoMovimiento;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;
import com.diegoalegil.animeshowdown.repository.MonederoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Operaciones atómicas sobre el saldo de moneda. Cada cambio escribe el saldo
 * materializado en {@code monedero} Y una fila en el ledger
 * {@code monedero_movimiento} dentro de la misma transacción.
 *
 * <p>Idempotencia de los créditos: re-chequeo por (usuario, motivo, referencia)
 * DENTRO del lock pesimista del monedero, con el UNIQUE constraint
 * {@code uk_mon_mov_idem} como red final. Al serializar el chequeo bajo el lock,
 * la carrera (dos créditos idénticos a la vez) NO llega a intentar el segundo
 * INSERT, así que no lanza {@link DataIntegrityViolationException} ni aborta la
 * transacción del llamador en Postgres.
 *
 * <p>Lost-update del saldo: {@code acreditar()} carga el monedero con
 * {@code findForUpdateByUsuarioId} (PESSIMISTIC_WRITE lock) antes del
 * read-modify-write. Eso serializa dos acreditaciones concurrentes del
 * mismo usuario; la segunda espera a que la primera confirme su saldo.
 */
@Service
public class MonederoService {

    private static final Logger log = LoggerFactory.getLogger(MonederoService.class);
    private static final List<MotivoMovimiento> MOTIVOS_DROP = List.of(
            MotivoMovimiento.DROP_VOTO,
            MotivoMovimiento.DROP_MISION_DIARIA,
            MotivoMovimiento.DROP_TORNEO,
            MotivoMovimiento.DROP_DUELO,
            MotivoMovimiento.DROP_JUEGO);

    private final MonederoRepository monederoRepo;
    private final MonederoMovimientoRepository movimientoRepo;
    private final UsuarioRepository usuarioRepo;

    public MonederoService(MonederoRepository monederoRepo,
                           MonederoMovimientoRepository movimientoRepo,
                           UsuarioRepository usuarioRepo) {
        this.monederoRepo = monederoRepo;
        this.movimientoRepo = movimientoRepo;
        this.usuarioRepo = usuarioRepo;
    }

    /** Saldo actual del usuario (0 si aún no tiene monedero). */
    @Transactional(readOnly = true)
    public long saldoDe(Usuario usuario) {
        return monederoRepo.findByUsuarioId(usuario.getId())
                .map(Monedero::getSaldo)
                .orElse(0L);
    }

    /**
     * ¿Ya se acreditó este (motivo, referencia) al usuario? Solo lectura — lo usa
     * la previsualización del drop de voto para devolver un "+N monedas" exacto
     * sin escribir (la acreditación real la hace el listener async idempotente).
     */
    @Transactional(readOnly = true)
    public boolean yaAcreditado(Usuario usuario, MotivoMovimiento motivo, String referencia) {
        return movimientoRepo.existsByUsuarioAndMotivoAndReferencia(usuario, motivo, referencia);
    }

    /** Nº de drops acreditados al usuario desde {@code desde} (para el tope diario). */
    @Transactional(readOnly = true)
    public long contarDropsHoy(Usuario usuario, LocalDateTime desde) {
        return movimientoRepo.countDropsDesde(usuario, MOTIVOS_DROP, desde);
    }

    /**
     * Acredita moneda de forma idempotente por (motivo, referencia). Si ese par
     * ya se aplicó, no hace nada y devuelve {@code aplicado=false}.
     *
     * <p>El monedero se carga con {@code findForUpdateByUsuarioId}
     * (PESSIMISTIC_WRITE lock) para evitar lost-update en dos acreditaciones
     * concurrentes del mismo usuario. El lock asegura que la segunda lectura
     * espere a que la primera confirme su saldo antes de modificarlo.
     *
     * <p>El chequeo de idempotencia va DENTRO del lock (igual que
     * {@link #acreditarDropConTopeDiario}): si lo hiciéramos antes de adquirirlo,
     * dos créditos concurrentes del mismo (motivo, referencia) verían ambos
     * {@code existsBy=false}, se serializarían en el lock, y el segundo intentaría
     * el INSERT igualmente — violando {@code uk_mon_mov_idem} y ABORTANDO en
     * Postgres la transacción del llamador ("current transaction is aborted").
     * Con el re-chequeo dentro del lock el segundo ve la fila ya confirmada y
     * devuelve {@code aplicado=false} sin tocar la BD; el UNIQUE queda solo como
     * red final. (Esto evita un 500 en el doble-click de cofre diario / la doble
     * entrega de recompensa de evento, que llaman este método dentro de SU tx.)
     */
    @Transactional
    public ResultadoCredito acreditar(Usuario usuario, MotivoMovimiento motivo,
            String referencia, long cantidad) {
        if (cantidad <= 0) {
            return new ResultadoCredito(false, saldoActual(usuario));
        }
        Monedero monedero = obtenerOCrearConLock(usuario);
        if (movimientoRepo.existsByUsuarioAndMotivoAndReferencia(usuario, motivo, referencia)) {
            return new ResultadoCredito(false, monedero.getSaldo());
        }
        long nuevoSaldo = monedero.getSaldo() + cantidad;
        monedero.setSaldo(nuevoSaldo);
        // save + flush: marca el dirty-check en el primer-level cache para que
        // la lectura del lock se materialice antes de la modificacion.
        monederoRepo.saveAndFlush(monedero);
        movimientoRepo.saveAndFlush(
                new MonederoMovimiento(usuario, cantidad, motivo, referencia, nuevoSaldo));
        return new ResultadoCredito(true, nuevoSaldo);
    }

    /**
     * Acredita un drop aplicando el tope diario dentro del mismo lock de
     * monedero que serializa el saldo. Así dos drops concurrentes del mismo
     * usuario no pueden leer el mismo contador diario antes de acreditar.
     */
    @Transactional
    public ResultadoDrop acreditarDropConTopeDiario(Usuario usuario, MotivoMovimiento motivo,
            String referencia, long cantidad, int topeDiario, LocalDateTime desde) {
        if (cantidad <= 0) {
            return new ResultadoDrop(ResultadoDrop.Estado.IDEMPOTENTE, saldoActual(usuario));
        }

        Monedero monedero = obtenerOCrearConLock(usuario);
        if (movimientoRepo.existsByUsuarioAndMotivoAndReferencia(usuario, motivo, referencia)) {
            return new ResultadoDrop(ResultadoDrop.Estado.IDEMPOTENTE, monedero.getSaldo());
        }

        long dropsHoy = movimientoRepo.countDropsDesde(usuario, MOTIVOS_DROP, desde);
        if (dropsHoy >= Math.max(1, topeDiario)) {
            return new ResultadoDrop(ResultadoDrop.Estado.TOPE_DIARIO, monedero.getSaldo());
        }

        long nuevoSaldo = monedero.getSaldo() + cantidad;
        monedero.setSaldo(nuevoSaldo);
        monederoRepo.saveAndFlush(monedero);
        movimientoRepo.saveAndFlush(
                new MonederoMovimiento(usuario, cantidad, motivo, referencia, nuevoSaldo));
        return new ResultadoDrop(ResultadoDrop.Estado.APLICADO, nuevoSaldo);
    }

    /**
     * Debita moneda (gasto). Usa lock pesimista sobre el monedero para serializar
     * gastos concurrentes del mismo usuario. Lanza 409 si el saldo es insuficiente.
     */
    @Transactional
    public long debitar(Usuario usuario, MotivoMovimiento motivo,
            String referencia, long cantidad) {
        if (cantidad <= 0) {
            throw new IllegalArgumentException("La cantidad a debitar debe ser positiva");
        }
        Monedero monedero = monederoRepo.findForUpdateByUsuarioId(usuario.getId())
                .orElseThrow(MonederoService::saldoInsuficiente);
        if (monedero.getSaldo() < cantidad) {
            throw saldoInsuficiente();
        }
        long nuevoSaldo = monedero.getSaldo() - cantidad;
        monedero.setSaldo(nuevoSaldo);
        monederoRepo.save(monedero);
        movimientoRepo.save(
                new MonederoMovimiento(usuario, -cantidad, motivo, referencia, nuevoSaldo));
        return nuevoSaldo;
    }

    /**
     * Obtiene el monedero del usuario (con lock) o lo crea si no existe.
     * El lock PESSIMISTIC_WRITE serializa dos acreditaciones concurrentes
     * del mismo usuario para que no haya lost-update en el saldo. Si aún no
     * existe monedero, bloquea primero la fila de usuario: así dos primeros
     * créditos concurrentes se serializan antes del INSERT y no dependen de
     * capturar una violación de unique dentro de una transacción ya abortada.
     */
    Monedero obtenerOCrearConLock(Usuario usuario) {
        // findForUpdateByUsuarioId tiene @Lock(PESSIMISTIC_WRITE) — bloquea la
        // fila monedero en la BD hasta que esta tx confirme/rollback.
        Optional<Monedero> existente = monederoRepo.findForUpdateByUsuarioId(usuario.getId());
        if (existente.isPresent()) {
            return existente.get();
        }

        usuarioRepo.findForUpdateById(usuario.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "Usuario no encontrado al crear monedero: " + usuario.getId()));

        Optional<Monedero> creadoMientrasEsperaba = monederoRepo.findForUpdateByUsuarioId(usuario.getId());
        if (creadoMientrasEsperaba.isPresent()) {
            return creadoMientrasEsperaba.get();
        }

        return monederoRepo.saveAndFlush(new Monedero(usuario));
    }

    /**
     * Crea el monedero directamente en la BD sin pasar por la logica de
     * acreditar (sin lock, sin idempotencia por referencia). Uso exclusivo
     * para tests que necesitan un monedero pre-existente.
     */
    Monedero crearMonederoParaTest(Usuario usuario) {
        return monederoRepo.save(new Monedero(usuario));
    }

    private long saldoActual(Usuario usuario) {
        return monederoRepo.findByUsuarioId(usuario.getId())
                .map(Monedero::getSaldo)
                .orElse(0L);
    }

    private static ResponseStatusException saldoInsuficiente() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Saldo insuficiente");
    }

    /** Resultado de un credito: si se aplico y el saldo tras la operacion. */
    public record ResultadoCredito(boolean aplicado, long saldo) {
    }

    public record ResultadoDrop(Estado estado, long saldo) {
        public enum Estado {
            APLICADO,
            IDEMPOTENTE,
            TOPE_DIARIO
        }
    }
}
