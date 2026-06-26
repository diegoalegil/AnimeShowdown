package com.diegoalegil.animeshowdown.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;

/**
 * Healthcheck del proveedor de email transaccional (Resend).
 *
 * <p>El fallo de email era el P0 oculto del embudo: sin {@code RESEND_API_KEY}
 * (o con el sender de prueba {@code onboarding@resend.dev}) el 100% de los
 * registros quedan {@code PENDIENTE} para siempre y el endpoint de registro
 * reporta éxito. {@code ProductionSecretsValidator} ya lo grita en boot; este
 * indicador lo hace observable <b>en caliente</b> en {@code /actuator/health}
 * para que un uptime monitor o un humano lo vea sin redeploy, y vigila además
 * el backlog de {@code email_failed_queue} (Resend caído / config podrida).
 *
 * <p><b>Nunca devuelve DOWN.</b> Un email mal configurado no debe tumbar el
 * healthcheck agregado: DOWN mapea a 503 y haría que Cloudflare/Railway
 * reiniciaran la app en bucle (un reboot no arregla un env var ausente). Igual
 * que {@code CatalogoHealthIndicator} con su status {@code DRIFT}, usamos el
 * status custom {@code DEGRADED} mapeado explícitamente a HTTP 200 en
 * {@code application.properties}. Con el {@code SimpleStatusAggregator} por
 * defecto, {@code DEGRADED} (status desconocido) es menos severo que {@code UP},
 * así que tampoco enmascara un {@code DOWN} real de otro indicador.
 *
 * <p>Expuesto en {@code /actuator/health} con la key {@code email}.
 */
@Component("email")
public class EmailHealthIndicator implements HealthIndicator {

    /** Sender de prueba de Resend: solo entrega al dueño de la cuenta. */
    private static final String SENDER_PRUEBA = "onboarding@resend.dev";

    /**
     * Umbral de fallos sin reintentar en cola por encima del cual marcamos
     * DEGRADED. Por debajo basta con mostrar el conteo (uno o dos pueden ser
     * direcciones inválidas puntuales, no un fallo sistémico).
     */
    private static final long UMBRAL_FALLOS_PENDIENTES = 10;

    private final EmailFailureRepository emailFailureRepository;
    private final boolean habilitado;
    private final boolean remitenteEsPrueba;
    private final String from;

    public EmailHealthIndicator(
            EmailFailureRepository emailFailureRepository,
            @Value("${email.resend.api-key:}") String apiKey,
            @Value("${email.resend.from:onboarding@resend.dev}") String from) {
        this.emailFailureRepository = emailFailureRepository;
        this.habilitado = apiKey != null && !apiKey.isBlank();
        String remitente = from == null ? "" : from.trim();
        this.remitenteEsPrueba = remitente.isBlank() || remitente.equalsIgnoreCase(SENDER_PRUEBA);
        this.from = remitente;
    }

    @Override
    public Health health() {
        if (!habilitado) {
            return Health.status("DEGRADED")
                    .withDetail("razon",
                            "RESEND_API_KEY vacía — email transaccional DESACTIVADO; "
                                    + "los registros quedan PENDIENTE sin verificar")
                    .build();
        }
        if (remitenteEsPrueba) {
            return Health.status("DEGRADED")
                    .withDetail("from", from.isBlank() ? "(vacío)" : from)
                    .withDetail("razon",
                            "RESEND_FROM usa el sender de prueba, que SOLO entrega al "
                                    + "dueño de la cuenta Resend — los usuarios reales no reciben nada")
                    .build();
        }

        long pendientes;
        try {
            pendientes = emailFailureRepository.countByReintentadoFalse();
        } catch (Exception e) {
            // No tumbamos el health por un fallo de lectura de la cola: el
            // envío puede estar sano. Reportamos UP con la incidencia.
            return Health.up()
                    .withDetail("from", from)
                    .withDetail("cola_fallos", "no consultable: " + e.getMessage())
                    .build();
        }
        if (pendientes >= UMBRAL_FALLOS_PENDIENTES) {
            return Health.status("DEGRADED")
                    .withDetail("from", from)
                    .withDetail("fallos_pendientes", pendientes)
                    .withDetail("razon",
                            "Demasiados emails en email_failed_queue — Resend caído o "
                                    + "configuración inválida; revisa as.funnel.email.fallo")
                    .build();
        }
        return Health.up()
                .withDetail("from", from)
                .withDetail("fallos_pendientes", pendientes)
                .build();
    }
}
