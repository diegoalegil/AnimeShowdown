package com.diegoalegil.animeshowdown.service;

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

/**
 * Operaciones atómicas sobre el saldo de moneda. Cada cambio escribe el saldo
 * materializado en {@code monedero} Y una fila en el ledger
 * {@code monedero_movimiento} dentro de la misma transacción.
 *
 * <p>Idempotencia de los créditos: pre-check por (usuario, motivo, referencia)
 * + UNIQUE constraint. En la carrera rara, el flush lanza
 * {@link DataIntegrityViolationException} y la transacción del crédito hace
 * rollback — el orquestador (DropService) la captura fuera de la tx.
 */
@Service
public class MonederoService {

    private static final Logger log = LoggerFactory.getLogger(MonederoService.class);

    private final MonederoRepository monederoRepo;
    private final MonederoMovimientoRepository movimientoRepo;

    public MonederoService(MonederoRepository monederoRepo, MonederoMovimientoRepository movimientoRepo) {
        this.monederoRepo = monederoRepo;
        this.movimientoRepo = movimientoRepo;
    }

    /** Saldo actual del usuario (0 si aún no tiene monedero). */
    @Transactional(readOnly = true)
    public long saldoDe(Usuario usuario) {
        return monederoRepo.findByUsuarioId(usuario.getId())
                .map(Monedero::getSaldo)
                .orElse(0L);
    }

    /**
     * Acredita moneda de forma idempotente por (motivo, referencia). Si ese par
     * ya se aplicó, no hace nada y devuelve {@code aplicado=false}. La carrera
     * (dos créditos idénticos a la vez) la corta el UNIQUE: el flush lanza
     * {@link DataIntegrityViolationException} y la tx hace rollback.
     */
    @Transactional
    public ResultadoCredito acreditar(Usuario usuario, MotivoMovimiento motivo, String referencia, long cantidad) {
        if (cantidad <= 0) {
            return new ResultadoCredito(false, saldoActual(usuario));
        }
        if (movimientoRepo.existsByUsuarioAndMotivoAndReferencia(usuario, motivo, referencia)) {
            return new ResultadoCredito(false, saldoActual(usuario));
        }
        Monedero monedero = obtenerOCrear(usuario);
        long nuevoSaldo = monedero.getSaldo() + cantidad;
        monedero.setSaldo(nuevoSaldo);
        monederoRepo.save(monedero);
        // saveAndFlush: si otro proceso aplicó el mismo (motivo, referencia) a la
        // vez, la violación UNIQUE salta aquí (no en un commit diferido) y la tx
        // entera —incluido el incremento de saldo— hace rollback.
        movimientoRepo.saveAndFlush(
                new MonederoMovimiento(usuario, cantidad, motivo, referencia, nuevoSaldo));
        return new ResultadoCredito(true, nuevoSaldo);
    }

    /**
     * Debita moneda (gasto). Usa lock pesimista sobre el monedero para serializar
     * gastos concurrentes del mismo usuario. Lanza 409 si el saldo es insuficiente.
     */
    @Transactional
    public long debitar(Usuario usuario, MotivoMovimiento motivo, String referencia, long cantidad) {
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

    private Monedero obtenerOCrear(Usuario usuario) {
        Optional<Monedero> existente = monederoRepo.findByUsuarioId(usuario.getId());
        if (existente.isPresent()) {
            return existente.get();
        }
        try {
            return monederoRepo.saveAndFlush(new Monedero(usuario));
        } catch (DataIntegrityViolationException e) {
            // Carrera en la creación del monedero (otro hilo lo creó primero).
            return monederoRepo.findByUsuarioId(usuario.getId()).orElseThrow(() -> e);
        }
    }

    private long saldoActual(Usuario usuario) {
        return monederoRepo.findByUsuarioId(usuario.getId())
                .map(Monedero::getSaldo)
                .orElse(0L);
    }

    private static ResponseStatusException saldoInsuficiente() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Saldo insuficiente");
    }

    /** Resultado de un crédito: si se aplicó y el saldo tras la operación. */
    public record ResultadoCredito(boolean aplicado, long saldo) {
    }
}
