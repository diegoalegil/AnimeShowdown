package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;

/**
 * El SERVIDOR decide qué/cuándo dropea moneda al jugar. Reglas:
 *
 * <ul>
 *   <li><b>Server-authoritative</b>: el cliente nunca pide un drop; se disparan
 *       desde listeners de eventos del dominio (voto, torneo, duelo).</li>
 *   <li><b>Idempotente</b>: cada drop lleva una {@code referencia} estable
 *       (ej. "voto:50", "dia:2026-05-30", "duelo:123"); MonederoService no lo
 *       aplica dos veces.</li>
 *   <li><b>Tope diario amplio</b>: anti-farmeo suave y configurable. Si el
 *       usuario ya superó el tope de drops del día, la acción sigue funcionando
 *       pero no genera moneda.</li>
 *   <li><b>Auditable</b>: cada moneda ganada queda en el audit log.</li>
 * </ul>
 *
 * <p>No es {@code @Transactional}: la unidad atómica es
 * {@link MonederoService#acreditar} (su propia tx). Así, si una carrera de
 * idempotencia hace rollback de ese crédito, se captura aquí limpiamente sin
 * envenenar una transacción externa.
 */
@Service
public class DropService {

    private static final Logger log = LoggerFactory.getLogger(DropService.class);

    private final MonederoService monederoService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final int topeDiario;
    private final Map<MotivoMovimiento, Long> recompensas;

    public DropService(
            MonederoService monederoService,
            AuditLogService auditLogService,
            Clock clock,
            @Value("${app.cartas.drop.voto:8}") long voto,
            @Value("${app.cartas.drop.mision-diaria:23}") long misionDiaria,
            @Value("${app.cartas.drop.torneo:38}") long torneo,
            @Value("${app.cartas.drop.duelo:30}") long duelo,
            @Value("${app.cartas.drop.tope-diario:100}") int topeDiario) {
        this.monederoService = monederoService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.topeDiario = Math.max(1, topeDiario);
        this.recompensas = new EnumMap<>(MotivoMovimiento.class);
        this.recompensas.put(MotivoMovimiento.DROP_VOTO, Math.max(0, voto));
        this.recompensas.put(MotivoMovimiento.DROP_MISION_DIARIA, Math.max(0, misionDiaria));
        this.recompensas.put(MotivoMovimiento.DROP_TORNEO, Math.max(0, torneo));
        this.recompensas.put(MotivoMovimiento.DROP_DUELO, Math.max(0, duelo));
    }

    /**
     * Intenta dropear la recompensa configurada para {@code motivo}. Devuelve el
     * resultado sin lanzar: una acción de juego nunca debe romperse porque su
     * drop no se haya aplicado.
     */
    public DropResultado otorgar(Usuario usuario, MotivoMovimiento motivo, String referencia) {
        if (usuario == null) {
            return DropResultado.OMITIDO;
        }
        Long cantidad = recompensas.get(motivo);
        if (cantidad == null || cantidad <= 0) {
            return DropResultado.OMITIDO;
        }
        try {
            MonederoService.ResultadoDrop credito =
                    monederoService.acreditarDropConTopeDiario(
                            usuario, motivo, referencia, cantidad, topeDiario, inicioDelDia());
            if (credito.estado() == MonederoService.ResultadoDrop.Estado.TOPE_DIARIO) {
                log.debug("Drop omitido por tope diario ({}): usuario={} motivo={}",
                        topeDiario, usuario.getUsername(), motivo);
                return DropResultado.TOPE_DIARIO;
            }
            if (credito.estado() == MonederoService.ResultadoDrop.Estado.IDEMPOTENTE) {
                return DropResultado.IDEMPOTENTE;
            }
            auditLogService.registrar(
                    AuditEvento.MONEDA_GANADA,
                    usuario,
                    Map.of(
                            "motivo", motivo.name(),
                            "delta", cantidad,
                            "referencia", referencia,
                            "saldo", credito.saldo()),
                    null);
            log.debug("Drop aplicado: usuario={} motivo={} cantidad={} saldo={}",
                    usuario.getUsername(), motivo, cantidad, credito.saldo());
            return DropResultado.APLICADO;
        } catch (DataIntegrityViolationException e) {
            // Carrera de idempotencia: el crédito ya hizo rollback en su propia tx.
            log.debug("Drop idempotente (carrera) usuario={} motivo={} ref={}",
                    usuario.getUsername(), motivo, referencia);
            return DropResultado.IDEMPOTENTE;
        }
    }

    private LocalDateTime inicioDelDia() {
        return LocalDate.now(clock)
                .atStartOfDay(clock.getZone())
                .withZoneSameInstant(ZoneOffset.UTC)
                .toLocalDateTime();
    }

    /** Desenlace de un intento de drop (para logging/tests; la acción no se rompe). */
    public enum DropResultado {
        /** Se acreditó moneda nueva. */
        APLICADO,
        /** Ya se había aplicado ese (motivo, referencia). */
        IDEMPOTENTE,
        /** El usuario alcanzó el tope diario de drops. */
        TOPE_DIARIO,
        /** Sin recompensa para ese motivo o usuario nulo. */
        OMITIDO
    }
}
