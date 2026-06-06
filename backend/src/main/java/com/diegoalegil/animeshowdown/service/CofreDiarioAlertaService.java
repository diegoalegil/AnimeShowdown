package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Recordatorio diario "tu cofre diario está listo": notifica a los usuarios que
 * aún no han reclamado el cofre de HOY. El cofre es una recompensa de login
 * universal (toda cuenta puede reclamarlo), así que el público es "todos los
 * no-reclamantes" (decisión del owner), acotado por {@code maxFanout}.
 *
 * <p>Reusa la idempotencia de {@link NotificacionService#crearSiNoExiste}
 * (eventoKey {@code cofre-disp:<fecha>}): re-ejecutar el job el mismo día no
 * duplica. Solo in-app (igual que las alertas de favorito); el cofre se detecta
 * por la ausencia del movimiento {@code COFRE_DIARIO} con referencia
 * {@code cofre:<fecha>} — la MISMA que escribe {@code CartaService} al reclamar.
 *
 * <p>Lo invoca {@link CofreDiarioAlertaJob} una vez al día. Best-effort: el
 * fallo de un usuario no detiene al resto ni rompe el job.
 */
@Service
public class CofreDiarioAlertaService {

    private static final Logger log = LoggerFactory.getLogger(CofreDiarioAlertaService.class);

    private final UsuarioRepository usuarioRepository;
    private final NotificacionService notificacionService;
    private final Clock clock;
    private final int maxFanout;

    public CofreDiarioAlertaService(
            UsuarioRepository usuarioRepository,
            NotificacionService notificacionService,
            Clock clock,
            @Value("${app.alertas-cofre.max-fanout:5000}") int maxFanout) {
        this.usuarioRepository = usuarioRepository;
        this.notificacionService = notificacionService;
        this.clock = clock;
        this.maxFanout = Math.max(1, maxFanout);
    }

    /** @return nº de recordatorios nuevos creados. */
    public int notificarCofreDisponible() {
        LocalDate hoy = LocalDate.now(clock);
        String referencia = "cofre:" + hoy;
        List<Usuario> noReclamantes = usuarioRepository.findSinMovimiento(
                MotivoMovimiento.COFRE_DIARIO, referencia, PageRequest.of(0, maxFanout));
        if (noReclamantes.isEmpty()) {
            return 0;
        }

        String eventoKey = "cofre-disp:" + hoy;
        String titulo = "Tu cofre diario está listo";
        String mensaje = "Reclama tu cofre gratis de hoy y suma monedas para abrir sobres.";
        String payload = "{\"link\":\"/cartas\"}";

        int creadas = 0;
        for (Usuario u : noReclamantes) {
            try {
                if (notificacionService.crearSiNoExiste(u, NotificacionTipo.COFRE_DISPONIBLE,
                        titulo, mensaje, payload, eventoKey)) {
                    creadas++;
                }
            } catch (Exception e) {
                log.warn("Cofre alerta: usuario={} falló: {}", u.getUsername(), e.getMessage());
            }
        }
        if (noReclamantes.size() >= maxFanout) {
            log.warn("Cofre alerta: fan-out topado en {} — puede haber más no-reclamantes sin avisar hoy",
                    maxFanout);
        }
        log.info("Cofre alerta: {} recordatorios creados (no-reclamantes={})", creadas, noReclamantes.size());
        return creadas;
    }
}
