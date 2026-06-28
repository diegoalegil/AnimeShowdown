package com.diegoalegil.animeshowdown.service;

import java.util.function.Supplier;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.atomic.AtomicInteger;

import com.diegoalegil.animeshowdown.model.EmailTipo;

@Component
public class AnimeShowdownMetrics {

    private final Counter votosTotal;
    private final Timer rankingRecalcDuration;
    private final DistributionSummary dueloSugeridoEloDiff;
    private final DistributionSummary dueloLiveWaitingSeconds;
    private final DistributionSummary dueloLiveRoundDecisionMs;
    private final AtomicInteger dueloLiveActiveMatches = new AtomicInteger(0);
    // Embudo de adquisición: antes había métricas de engagement pero CERO del
    // funnel registro→verificación→voto. Estos contadores hacen visible en
    // Prometheus dónde se cae el embudo — la pregunta que el producto no podía
    // responder ("de 100 visitas, cuántas registran y verifican").
    private final Counter funnelRegistro;
    private final Counter funnelEmailEmitida;
    private final Counter funnelEmailConfirmada;
    private final MeterRegistry registry;

    public AnimeShowdownMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.votosTotal = Counter.builder("as.votos.total")
                .description("Total de votos registrados por el backend")
                .register(registry);
        this.rankingRecalcDuration = Timer.builder("as.ranking.recalc.duration")
                .description("Tiempo empleado en recalcular rankings públicos")
                .publishPercentileHistogram(false)
                .register(registry);
        this.dueloSugeridoEloDiff = DistributionSummary.builder("as.duelo.sugerido.elo.diff")
                .description("Diferencia de ELO estimado entre personajes sugeridos en /api/votar/sugerir-duelo")
                .baseUnit("elo")
                .publishPercentileHistogram(false)
                .register(registry);
        this.dueloLiveWaitingSeconds = DistributionSummary.builder("as.duelo.live.waiting.seconds")
                .description("Tiempo de espera en cola antes de emparejar un duelo PvP")
                .baseUnit("seconds")
                .publishPercentileHistogram(false)
                .register(registry);
        this.dueloLiveRoundDecisionMs = DistributionSummary.builder("as.duelo.live.round.decision.ms")
                .description("Latencia entre cierre de ronda PvP y decisión de resultado")
                .baseUnit("milliseconds")
                .publishPercentileHistogram(false)
                .register(registry);
        io.micrometer.core.instrument.Gauge.builder("as.duelo.live.active.matches", dueloLiveActiveMatches, AtomicInteger::get)
                .description("Duelos PvP activos ahora")
                .register(registry);
        this.funnelRegistro = Counter.builder("as.funnel.registro.completado")
                .description("Registros de usuario completados (email + OAuth)")
                .register(registry);
        this.funnelEmailEmitida = Counter.builder("as.funnel.email.verificacion.emitida")
                .description("Emails de verificación encolados (registro + reenvíos; NO dividir por registro)")
                .register(registry);
        this.funnelEmailConfirmada = Counter.builder("as.funnel.email.verificacion.confirmada")
                .description("Verificaciones de email confirmadas (cuenta activada)")
                .register(registry);
    }

    public void votoRegistrado() {
        votosTotal.increment();
    }

    public <T> T recordRanking(Supplier<T> supplier) {
        return rankingRecalcDuration.record(supplier);
    }

    public void dueloSugerido(int eloDiff) {
        dueloSugeridoEloDiff.record(eloDiff);
    }

    public void dueloLiveWaitingSeconds(double seconds) {
        dueloLiveWaitingSeconds.record(Math.max(0, seconds));
    }

    public void dueloLiveCompleted(String outcome) {
        Counter.builder("as.duelo.live.completed")
                .description("Duelos PvP completados por resultado")
                .tag("outcome", outcome == null ? "unknown" : outcome)
                .register(registry)
                .increment();
    }

    public void dueloLiveActiveMatches(int active) {
        dueloLiveActiveMatches.set(Math.max(0, active));
    }

    public void dueloLiveRoundDecisionMs(long ms) {
        dueloLiveRoundDecisionMs.record(Math.max(0, ms));
    }

    /** Embudo: un registro de usuario se completó (email/password u OAuth). */
    public void registroCompletado() {
        funnelRegistro.increment();
    }

    /**
     * Embudo: se encoló un email de verificación. Cuenta tanto el del registro
     * como los reenvíos (resend-verification), así que NO es un conteo
     * por-registro y emitida/registro puede ser &gt; 1.
     */
    public void emailVerificacionEmitida() {
        funnelEmailEmitida.increment();
    }

    /** Embudo: el usuario confirmó su email y la cuenta pasó a ACTIVO. */
    public void emailVerificacionConfirmada() {
        funnelEmailConfirmada.increment();
    }

    /** Email entregado a Resend sin error (segmentado por tipo). */
    public void emailEnviado(EmailTipo tipo) {
        Counter.builder("as.funnel.email.enviado")
                .description("Emails entregados a Resend sin error")
                .tag("tipo", tipo == null ? "desconocido" : tipo.name())
                .register(registry)
                .increment();
    }

    /**
     * Email que agotó los reintentos y cayó en email_failed_queue. Es la
     * señal de alerta que el roadmap pide ({@code email_verification_send_failures}):
     * si esto sube, el 100% de los registros quedan PENDIENTE en silencio.
     */
    public void emailFallo(EmailTipo tipo) {
        Counter.builder("as.funnel.email.fallo")
                .description("Emails que agotaron los reintentos (cayeron en email_failed_queue)")
                .tag("tipo", tipo == null ? "desconocido" : tipo.name())
                .register(registry)
                .increment();
    }

    /** Embudo: voto persistido, segmentado por tipo de votante. */
    public void votoFunnel(String tipo) {
        Counter.builder("as.funnel.voto")
                .description("Votos persistidos por tipo de votante (anonimo/registrado/empate)")
                .tag("tipo", tipo == null ? "desconocido" : tipo)
                .register(registry)
                .increment();
    }

    /**
     * Embudo client-side: paso del funnel que el servidor no ve (landing, muro
     * de votos, share, llegada con referral). El nombre llega ya validado contra
     * un whitelist en {@code FunnelController}, así que la cardinalidad del tag
     * está acotada (no hay explosión de series en Prometheus).
     */
    public void clientEvent(String evento) {
        Counter.builder("as.funnel.client")
                .description("Pasos del embudo reportados por el navegador via beacon")
                .tag("evento", evento == null ? "desconocido" : evento)
                .register(registry)
                .increment();
    }

    /**
     * Beacon cliente con un nombre FUERA del whitelist. Tag FIJO (una sola serie,
     * cardinalidad acotada) para detectar drift cliente↔backend —p.ej. un deploy
     * del front que emite un evento que el backend aún no reconoce— sin abrir la
     * métrica a nombres arbitrarios.
     */
    public void clientEventRechazado() {
        Counter.builder("as.funnel.client")
                .description("Pasos del embudo reportados por el navegador via beacon")
                .tag("evento", "otro_no_reconocido")
                .register(registry)
                .increment();
    }
}
