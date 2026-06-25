package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.DueloLiveStateDto;
import com.diegoalegil.animeshowdown.dto.DueloSugeridoDto;
import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveChoice;
import com.diegoalegil.animeshowdown.model.DueloLiveEstado;
import com.diegoalegil.animeshowdown.model.DueloLiveRonda;
import com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.DueloLiveRepository;
import com.diegoalegil.animeshowdown.repository.DueloLiveRondaRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@Service
public class DueloLiveService {

    private static final int MAX_ELO_DIFF = 100;
    private static final int ROUND_SECONDS = 12;
    private static final int WALKOVER_GRACE_SECONDS = 15;
    private static final int COMPLETED_PER_HOUR_LIMIT = 10;

    private final DueloLiveRepository dueloRepository;
    private final DueloLiveRondaRepository rondaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PersonajeRepository personajeRepository;
    private final DueloSugeridoService dueloSugeridoService;
    private final AnimeShowdownMetrics metrics;
    private final SimpMessagingTemplate messaging;
    private final DueloLiveNotifier notifier;
    private final DueloLiveBotPolicy botPolicy;
    private final MatchFinalizationService matchFinalization;
    private final Clock clock;
    private final boolean scheduledMaintenanceEnabled;
    private final int fallbackAfterSeconds;

    public DueloLiveService(DueloLiveRepository dueloRepository,
            DueloLiveRondaRepository rondaRepository,
            UsuarioRepository usuarioRepository,
            PersonajeRepository personajeRepository,
            DueloSugeridoService dueloSugeridoService,
            AnimeShowdownMetrics metrics,
            SimpMessagingTemplate messaging,
            DueloLiveNotifier notifier,
            DueloLiveBotPolicy botPolicy,
            MatchFinalizationService matchFinalization,
            Clock clock,
            @Value("${app.duelo-live.fallback-after-seconds:5}")
            int fallbackAfterSeconds,
            @Value("${app.duelo-live.scheduled-maintenance.enabled:true}")
            boolean scheduledMaintenanceEnabled) {
        this.dueloRepository = dueloRepository;
        this.rondaRepository = rondaRepository;
        this.usuarioRepository = usuarioRepository;
        this.personajeRepository = personajeRepository;
        this.dueloSugeridoService = dueloSugeridoService;
        this.metrics = metrics;
        this.messaging = messaging;
        this.notifier = notifier;
        this.botPolicy = botPolicy;
        this.matchFinalization = matchFinalization;
        this.clock = clock;
        this.fallbackAfterSeconds = Math.max(3, fallbackAfterSeconds);
        this.scheduledMaintenanceEnabled = scheduledMaintenanceEnabled;
    }

    @Transactional
    public synchronized DueloLiveStateDto entrarCola(Usuario usuario, String ip) {
        Usuario jugador = usuarioRepository.findById(usuario.getId()).orElseThrow();
        Optional<DueloLive> activo = dueloActivo(jugador);
        if (activo.isPresent()) {
            return notifier.estadoPara(activo.get(), jugador, "STATE_RESTORED", null);
        }
        long completadosHora = dueloRepository.countCompletadosDesde(jugador, now().minusHours(1));
        if (completadosHora >= COMPLETED_PER_HOUR_LIMIT) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Cooldown PvP: máximo 10 duelos completados por hora");
        }

        List<DueloLive> esperando = dueloRepository.findWaitingOrderByCreadoEnForUpdate();
        if (esperando.stream().anyMatch(d -> ip != null && ip.equals(d.getJugador1Ip())
                && !d.getJugador1().getId().equals(jugador.getId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No puedes emparejarte con otro usuario desde la misma IP");
        }

        Optional<DueloLive> candidato = esperando.stream()
                .filter(d -> !d.getJugador1().getId().equals(jugador.getId()))
                .filter(d -> d.getJugador1Ip() == null || ip == null || !d.getJugador1Ip().equals(ip))
                .filter(d -> Math.abs(d.getJugador1().getEloPvp() - jugador.getEloPvp()) <= MAX_ELO_DIFF)
                .min(Comparator.comparingInt(d -> Math.abs(d.getJugador1().getEloPvp() - jugador.getEloPvp())));

        if (candidato.isPresent()) {
            DueloLive duelo = candidato.get();
            duelo.setJugador2(jugador);
            duelo.setJugador2Ip(ip);
            prepararMatch(duelo, false);
            dueloRepository.save(duelo);
            metrics.dueloLiveWaitingSeconds(Duration.between(duelo.getCreadoEn(), now()).toSeconds());
            notifier.emitirEstado(duelo, "MATCH_FOUND", "Rival encontrado");
            return notifier.estadoPara(duelo, jugador, "MATCH_FOUND", "Rival encontrado");
        }

        DueloLive duelo = dueloRepository.save(new DueloLive(jugador, ip, now()));
        metrics.dueloLiveActiveMatches((int) dueloRepository.countByEstadoIn(List.of(
                DueloLiveEstado.WAITING, DueloLiveEstado.MATCHED, DueloLiveEstado.IN_PROGRESS)));
        DueloLiveStateDto estado = notifier.estadoPara(duelo, jugador, "WAITING_OPPONENT", "Buscando rival");
        messaging.convertAndSendToUser(jugador.getUsername(), "/queue/duelo", estado);
        return estado;
    }

    @Transactional(readOnly = true)
    public DueloLiveStateDto estado(Long dueloId, Usuario usuario) {
        DueloLive duelo = dueloRepository.findDetalleById(dueloId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Duelo no encontrado"));
        if (!duelo.participa(usuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No participas en este duelo");
        }
        return notifier.estadoPara(duelo, usuario, "STATE", null);
    }

    @Transactional(readOnly = true)
    public DueloLiveStateDto miDueloActivo(Usuario usuario) {
        return dueloActivo(usuario)
                .map(d -> notifier.estadoPara(d, usuario, "STATE_RESTORED", null))
                .orElse(null);
    }

    @Transactional
    public DueloLiveStateDto votar(Long dueloId, Usuario usuario, DueloLiveChoice choice) {
        if (choice == DueloLiveChoice.EMPATE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo puedes votar A o B");
        }
        DueloLive duelo = dueloRepository.findByIdForUpdate(dueloId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Duelo no encontrado"));
        if (!duelo.participa(usuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No participas en este duelo");
        }
        if (duelo.getEstado() != DueloLiveEstado.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El duelo no está en progreso");
        }
        marcarSeen(duelo, usuario);
        DueloLiveRonda ronda = rondaActiva(dueloId);
        LocalDateTime now = now();
        if (now.isBefore(ronda.getAbreEn())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La ronda todavía no está abierta");
        }
        if (now.isAfter(ronda.getCierraEn()) && !now.isAfter(ronda.getCierraEn().plusSeconds(WALKOVER_GRACE_SECONDS))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La ronda ya cerró");
        }
        if (now.isAfter(ronda.getCierraEn().plusSeconds(WALKOVER_GRACE_SECONDS))) {
            return resolverWalkoverPorTimeout(duelo, ronda, now, "timeout");
        }
        if (duelo.esJugador1(usuario)) {
            if (ronda.getVotoJugador1() != null) {
                return notifier.estadoPara(duelo, usuario, "VOTE_RECEIVED", "Tu voto ya estaba registrado");
            }
            ronda.setVotoJugador1(choice);
            ronda.setVotoJugador1En(now);
        } else {
            if (ronda.getVotoJugador2() != null) {
                return notifier.estadoPara(duelo, usuario, "VOTE_RECEIVED", "Tu voto ya estaba registrado");
            }
            ronda.setVotoJugador2(choice);
            ronda.setVotoJugador2En(now);
        }
        if (duelo.isJugador2Bot() && ronda.getVotoJugador2() == null) {
            ronda.setVotoJugador2(botPolicy.votoBot(ronda));
            ronda.setVotoJugador2En(now);
        }
        rondaRepository.save(ronda);
        messaging.convertAndSendToUser(usuario.getUsername(), "/queue/duelo",
                notifier.estadoPara(duelo, usuario, "VOTE_RECEIVED", "Voto registrado"));

        if (ronda.ambosVotaron(duelo.isJugador2Bot())) {
            resolverRonda(duelo, ronda, now);
        } else {
            notifier.emitirEstado(duelo, "VOTE_RECEIVED", "Voto recibido");
        }
        return notifier.estadoPara(duelo, usuario, "VOTE_RECEIVED", "Voto registrado");
    }

    @Transactional
    public DueloLiveStateDto abandonar(Long dueloId, Usuario usuario) {
        DueloLive duelo = dueloRepository.findByIdForUpdate(dueloId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Duelo no encontrado"));
        if (!duelo.participa(usuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No participas en este duelo");
        }
        if (duelo.getEstado() == DueloLiveEstado.WAITING) {
            duelo.setEstado(DueloLiveEstado.ABANDONED);
            duelo.setAbandonador(usuario);
            duelo.setAbandonedEn(now());
            dueloRepository.save(duelo);
            notifier.emitirEstado(duelo, "MATCH_END", "Cola cancelada");
            return notifier.estadoPara(duelo, usuario, "MATCH_END", "Cola cancelada");
        }
        if (duelo.getEstado() == DueloLiveEstado.IN_PROGRESS || duelo.getEstado() == DueloLiveEstado.MATCHED) {
            matchFinalization.finalizarWalkover(duelo, usuario, "leave");
        }
        return notifier.estadoPara(duelo, usuario, "MATCH_END", "Duelo abandonado");
    }

    // 2s (antes 3s): es el latido que asigna bots y resuelve rondas; con 3s
    // la espera percibida en PvP era visiblemente más larga que el countdown.
    @Scheduled(fixedRate = 2_000)
    @Transactional
    public void mantenimientoLiveProgramado() {
        if (!scheduledMaintenanceEnabled) return;
        mantenimientoLiveInternal();
    }

    @Transactional
    public void mantenimientoLive() {
        mantenimientoLiveInternal();
    }

    private void mantenimientoLiveInternal() {
        LocalDateTime now = now();
        LocalDateTime limiteFallback = now.minusSeconds(fallbackAfterSeconds);
        for (DueloLive duelo : dueloRepository.findWaitingDueForUpdate(limiteFallback)) {
            if (duelo.getEstado() != DueloLiveEstado.WAITING) continue;
            prepararMatch(duelo, true);
            dueloRepository.save(duelo);
            notifier.emitirEstado(duelo, "MATCH_FOUND", "Rival encontrado");
        }
        for (DueloLiveRonda ronda : rondaRepository.findExpiradas(now.minusSeconds(WALKOVER_GRACE_SECONDS))) {
            if (ronda.getDuelo().getEstado() == DueloLiveEstado.IN_PROGRESS) {
                resolverWalkoverPorTimeout(ronda.getDuelo(), ronda, now, "scheduled_timeout");
            }
        }
        metrics.dueloLiveActiveMatches((int) dueloRepository.countByEstadoIn(List.of(
                DueloLiveEstado.WAITING, DueloLiveEstado.MATCHED, DueloLiveEstado.IN_PROGRESS)));
    }

    private void prepararMatch(DueloLive duelo, boolean bot) {
        LocalDateTime now = now();
        duelo.setJugador2Bot(bot);
        duelo.setEstado(DueloLiveEstado.MATCHED);
        duelo.setMatchedEn(now);
        duelo.setStartedEn(now.plusSeconds(3));
        duelo.setJugador1EloBefore(duelo.getJugador1().getEloPvp());
        duelo.setJugador2EloBefore(bot || duelo.getJugador2() == null ? 1000 : duelo.getJugador2().getEloPvp());
        duelo.setLastSeenJugador1(now);
        duelo.setLastSeenJugador2(now);
        duelo.setEstado(DueloLiveEstado.IN_PROGRESS);
        iniciarNuevaRonda(duelo, now.plusSeconds(3));
    }

    private DueloLiveRonda iniciarNuevaRonda(DueloLive duelo, LocalDateTime abreEn) {
        DueloSugeridoDto sugerido = dueloSugeridoService.sugerir();
        Personaje a = personajeRepository.findById(sugerido.personaje1().getId()).orElseThrow();
        Personaje b = personajeRepository.findById(sugerido.personaje2().getId()).orElseThrow();
        int numero = duelo.getRondaActual() + 1;
        duelo.setRondaActual(numero);
        DueloLiveRonda ronda = rondaRepository.save(new DueloLiveRonda(
                duelo,
                numero,
                a,
                b,
                abreEn,
                abreEn.plusSeconds(ROUND_SECONDS)));
        dueloRepository.save(duelo);
        return ronda;
    }

    private DueloLiveRonda rondaActiva(Long dueloId) {
        return rondaRepository.findRondaActivaForUpdate(dueloId).stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No hay ronda activa"));
    }

    private void resolverRonda(DueloLive duelo, DueloLiveRonda ronda, LocalDateTime now) {
        // Guard idempotente: el scheduler de timeout (findExpiradas, sin lock) y un
        // voto que cierra la ronda pueden entrar a la vez sobre la misma ronda. Si
        // ya está resuelta, salir: re-resolverla incrementaría el marcador dos veces.
        if (ronda.getEstado() != DueloLiveRondaEstado.IN_PROGRESS) {
            return;
        }
        long started = System.nanoTime();
        var scores = botPolicy.scoresComunidad(ronda);
        DueloLiveChoice correcta = botPolicy.decisionComunidad(ronda, scores);
        ronda.setEleccionCorrecta(correcta);
        ronda.setCerradaEn(now);
        if (correcta == DueloLiveChoice.EMPATE) {
            ronda.setEstado(DueloLiveRondaEstado.VOID);
            ronda.setDecisionMs(elapsedMs(started));
            rondaRepository.save(ronda);
            metrics.dueloLiveRoundDecisionMs(ronda.getDecisionMs());
            iniciarNuevaRonda(duelo, now.plusSeconds(1));
            notifier.emitirEstado(duelo, "ROUND_END", "Ronda nula: la comunidad está empatada");
            return;
        }
        boolean j1 = correcta == ronda.getVotoJugador1();
        boolean j2 = correcta == ronda.getVotoJugador2();
        ronda.setJugador1Acerto(j1);
        ronda.setJugador2Acerto(j2);
        ronda.setEstado(DueloLiveRondaEstado.FINISHED);
        ronda.setDecisionMs(elapsedMs(started));
        rondaRepository.save(ronda);
        metrics.dueloLiveRoundDecisionMs(ronda.getDecisionMs());

        if (j1) duelo.setScoreJugador1(duelo.getScoreJugador1() + 1);
        if (j2) duelo.setScoreJugador2(duelo.getScoreJugador2() + 1);
        duelo.setRondasValidas(duelo.getRondasValidas() + 1);

        if (debeFinalizar(duelo)) {
            matchFinalization.finalizarPorScore(duelo);
            notifier.emitirEstado(duelo, "MATCH_END", "Duelo terminado");
        } else {
            dueloRepository.save(duelo);
            iniciarNuevaRonda(duelo, now.plusSeconds(1));
            notifier.emitirEstado(duelo, "ROUND_END", "Ronda resuelta");
        }
    }

    private boolean debeFinalizar(DueloLive duelo) {
        if (duelo.getScoreJugador1() >= 3 && duelo.getScoreJugador1() > duelo.getScoreJugador2()) return true;
        if (duelo.getScoreJugador2() >= 3 && duelo.getScoreJugador2() > duelo.getScoreJugador1()) return true;
        return duelo.getRondasValidas() >= 5;
    }

    private DueloLiveStateDto resolverWalkoverPorTimeout(DueloLive duelo, DueloLiveRonda ronda, LocalDateTime now, String reason) {
        Usuario abandonador;
        if (ronda.getVotoJugador1() == null && !duelo.isJugador2Bot()) {
            abandonador = duelo.getJugador1();
        } else if (ronda.getVotoJugador2() == null && duelo.getJugador2() != null) {
            abandonador = duelo.getJugador2();
        } else {
            // Ambos votaron → resolver la ronda. El scheduler la leyó vía findExpiradas
            // SIN lock, así que recargamos la ronda activa CON lock pesimista para
            // serializarnos con la vía del voto (findRondaActivaForUpdate): sin esto, el
            // tick del scheduler y un voto que cierra la ronda podían resolverla a la vez
            // (DueloLiveRonda no tiene @Version), duplicando score/rondasValidas y
            // abriendo dos rondas. Si entre medias el voto ya la resolvió/avanzó, la
            // ronda activa será otra (o ninguna) → no hacemos nada.
            DueloLiveRonda activa = rondaRepository.findRondaActivaForUpdate(duelo.getId())
                    .stream().findFirst().orElse(null);
            if (activa != null && activa.getId().equals(ronda.getId())) {
                resolverRonda(duelo, activa, now);
            }
            return notifier.estadoPara(duelo, duelo.getJugador1(), "ROUND_END", "Ronda resuelta");
        }
        // Recargar duelo con lock antes de finalizar para evitar carrera
        // entre scheduler y voto cerca de la ventana de cierra.
        DueloLive locked = dueloRepository.findByIdForFinalize(duelo.getId())
                .orElseThrow(() -> new IllegalStateException("Duelo no encontrado: " + duelo.getId()));
        matchFinalization.finalizarWalkover(locked, abandonador, reason);
        return notifier.estadoPara(locked, duelo.getJugador1(), "OPPONENT_ABANDONED", "Walkover por inactividad");
    }

    private void marcarSeen(DueloLive duelo, Usuario usuario) {
        if (duelo.esJugador1(usuario)) {
            duelo.setLastSeenJugador1(now());
        } else if (duelo.esJugador2(usuario)) {
            duelo.setLastSeenJugador2(now());
        }
    }

    private Optional<DueloLive> dueloActivo(Usuario usuario) {
        return dueloRepository.findActivosDeUsuario(usuario,
                        List.of(DueloLiveEstado.WAITING, DueloLiveEstado.MATCHED, DueloLiveEstado.IN_PROGRESS),
                        PageRequest.of(0, 1))
                .stream()
                .findFirst();
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private static long elapsedMs(long startedNano) {
        return Math.max(0, (System.nanoTime() - startedNano) / 1_000_000);
    }

}
