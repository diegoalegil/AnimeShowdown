package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.DueloLiveRoundDto;
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
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@Service
public class DueloLiveService {

    private static final Logger log = LoggerFactory.getLogger(DueloLiveService.class);
    private static final int MAX_ELO_DIFF = 100;
    private static final int ROUND_SECONDS = 12;
    private static final int BOT_AFTER_SECONDS = 30;
    private static final int WALKOVER_GRACE_SECONDS = 15;
    private static final int COMPLETED_PER_HOUR_LIMIT = 10;

    private final DueloLiveRepository dueloRepository;
    private final DueloLiveRondaRepository rondaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;
    private final DueloSugeridoService dueloSugeridoService;
    private final PvpEloService pvpEloService;
    private final AnimeShowdownMetrics metrics;
    private final SimpMessagingTemplate messaging;
    private final BadgeService badgeService;
    private final Clock clock;

    public DueloLiveService(DueloLiveRepository dueloRepository,
            DueloLiveRondaRepository rondaRepository,
            UsuarioRepository usuarioRepository,
            PersonajeRepository personajeRepository,
            VotoRepository votoRepository,
            DueloSugeridoService dueloSugeridoService,
            PvpEloService pvpEloService,
            AnimeShowdownMetrics metrics,
            SimpMessagingTemplate messaging,
            BadgeService badgeService,
            Clock clock) {
        this.dueloRepository = dueloRepository;
        this.rondaRepository = rondaRepository;
        this.usuarioRepository = usuarioRepository;
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
        this.dueloSugeridoService = dueloSugeridoService;
        this.pvpEloService = pvpEloService;
        this.metrics = metrics;
        this.messaging = messaging;
        this.badgeService = badgeService;
        this.clock = clock;
    }

    @Transactional
    public synchronized DueloLiveStateDto entrarCola(Usuario usuario, String ip) {
        Usuario jugador = usuarioRepository.findById(usuario.getId()).orElseThrow();
        Optional<DueloLive> activo = dueloActivo(jugador);
        if (activo.isPresent()) {
            return estadoPara(activo.get(), jugador, "STATE_RESTORED", null);
        }
        long completadosHora = dueloRepository.countCompletadosDesde(jugador, now().minusHours(1));
        if (completadosHora >= COMPLETED_PER_HOUR_LIMIT) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Cooldown PvP: máximo 10 duelos completados por hora");
        }

        List<DueloLive> esperando = dueloRepository.findWaitingOrderByCreadoEn();
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
            emitirEstado(duelo, "MATCH_FOUND", "Rival encontrado");
            return estadoPara(duelo, jugador, "MATCH_FOUND", "Rival encontrado");
        }

        DueloLive duelo = dueloRepository.save(new DueloLive(jugador, ip, now()));
        metrics.dueloLiveActiveMatches((int) dueloRepository.countByEstadoIn(List.of(
                DueloLiveEstado.WAITING, DueloLiveEstado.MATCHED, DueloLiveEstado.IN_PROGRESS)));
        DueloLiveStateDto estado = estadoPara(duelo, jugador, "WAITING_OPPONENT", "Buscando rival");
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
        return estadoPara(duelo, usuario, "STATE", null);
    }

    @Transactional(readOnly = true)
    public DueloLiveStateDto miDueloActivo(Usuario usuario) {
        return dueloActivo(usuario)
                .map(d -> estadoPara(d, usuario, "STATE_RESTORED", null))
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
                return estadoPara(duelo, usuario, "VOTE_RECEIVED", "Tu voto ya estaba registrado");
            }
            ronda.setVotoJugador1(choice);
            ronda.setVotoJugador1En(now);
        } else {
            if (ronda.getVotoJugador2() != null) {
                return estadoPara(duelo, usuario, "VOTE_RECEIVED", "Tu voto ya estaba registrado");
            }
            ronda.setVotoJugador2(choice);
            ronda.setVotoJugador2En(now);
        }
        if (duelo.isJugador2Bot() && ronda.getVotoJugador2() == null) {
            ronda.setVotoJugador2(votoBot(ronda));
            ronda.setVotoJugador2En(now);
        }
        rondaRepository.save(ronda);
        messaging.convertAndSendToUser(usuario.getUsername(), "/queue/duelo",
                estadoPara(duelo, usuario, "VOTE_RECEIVED", "Voto registrado"));

        if (ronda.ambosVotaron(duelo.isJugador2Bot())) {
            resolverRonda(duelo, ronda, now);
        } else {
            emitirEstado(duelo, "VOTE_RECEIVED", "Voto recibido");
        }
        return estadoPara(duelo, usuario, "VOTE_RECEIVED", "Voto registrado");
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
            emitirEstado(duelo, "MATCH_END", "Cola cancelada");
            return estadoPara(duelo, usuario, "MATCH_END", "Cola cancelada");
        }
        if (duelo.getEstado() == DueloLiveEstado.IN_PROGRESS || duelo.getEstado() == DueloLiveEstado.MATCHED) {
            finalizarWalkover(duelo, usuario, "leave");
        }
        return estadoPara(duelo, usuario, "MATCH_END", "Duelo abandonado");
    }

    @Scheduled(fixedRate = 5_000)
    @Transactional
    public void mantenimientoLive() {
        LocalDateTime now = now();
        for (DueloLive duelo : dueloRepository.findByEstadoIn(List.of(DueloLiveEstado.WAITING))) {
            if (Duration.between(duelo.getCreadoEn(), now).getSeconds() >= BOT_AFTER_SECONDS) {
                prepararMatch(duelo, true);
                dueloRepository.save(duelo);
                emitirEstado(duelo, "MATCH_FOUND", "No había rival humano: entra el bot");
            }
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
        long started = System.nanoTime();
        DueloLiveChoice correcta = decisionComunidad(ronda);
        ronda.setEleccionCorrecta(correcta);
        ronda.setCerradaEn(now);
        if (correcta == DueloLiveChoice.EMPATE) {
            ronda.setEstado(DueloLiveRondaEstado.VOID);
            ronda.setDecisionMs(elapsedMs(started));
            rondaRepository.save(ronda);
            metrics.dueloLiveRoundDecisionMs(ronda.getDecisionMs());
            iniciarNuevaRonda(duelo, now.plusSeconds(1));
            emitirEstado(duelo, "ROUND_END", "Ronda nula: la comunidad está empatada");
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
            finalizarPorScore(duelo);
            emitirEstado(duelo, "MATCH_END", "Duelo terminado");
        } else {
            dueloRepository.save(duelo);
            iniciarNuevaRonda(duelo, now.plusSeconds(1));
            emitirEstado(duelo, "ROUND_END", "Ronda resuelta");
        }
    }

    private boolean debeFinalizar(DueloLive duelo) {
        if (duelo.getScoreJugador1() >= 3 && duelo.getScoreJugador1() > duelo.getScoreJugador2()) return true;
        if (duelo.getScoreJugador2() >= 3 && duelo.getScoreJugador2() > duelo.getScoreJugador1()) return true;
        return duelo.getRondasValidas() >= 5;
    }

    private void finalizarPorScore(DueloLive duelo) {
        double scoreJ1;
        if (duelo.getScoreJugador1() > duelo.getScoreJugador2()) {
            scoreJ1 = 1.0;
            duelo.setGanador(duelo.getJugador1());
            badgeService.desbloquear(duelo.getJugador1(), "primera_victoria_pvp");
        } else if (duelo.getScoreJugador2() > duelo.getScoreJugador1()) {
            scoreJ1 = 0.0;
            duelo.setGanador(duelo.getJugador2());
            if (duelo.getJugador2() != null) {
                badgeService.desbloquear(duelo.getJugador2(), "primera_victoria_pvp");
            }
        } else {
            scoreJ1 = 0.5;
        }
        aplicarEloYFinalizar(duelo, scoreJ1, false);
    }

    private DueloLiveStateDto resolverWalkoverPorTimeout(DueloLive duelo, DueloLiveRonda ronda, LocalDateTime now, String reason) {
        Usuario abandonador;
        if (ronda.getVotoJugador1() == null && !duelo.isJugador2Bot()) {
            abandonador = duelo.getJugador1();
        } else if (ronda.getVotoJugador2() == null && duelo.getJugador2() != null) {
            abandonador = duelo.getJugador2();
        } else {
            resolverRonda(duelo, ronda, now);
            return estadoPara(duelo, duelo.getJugador1(), "ROUND_END", "Ronda resuelta");
        }
        finalizarWalkover(duelo, abandonador, reason);
        return estadoPara(duelo, duelo.getJugador1(), "OPPONENT_ABANDONED", "Walkover por inactividad");
    }

    private void finalizarWalkover(DueloLive duelo, Usuario abandonador, String reason) {
        boolean abandonadorEsJ1 = duelo.esJugador1(abandonador);
        duelo.setAbandonador(abandonador);
        duelo.setAbandonedEn(now());
        duelo.setGanador(abandonadorEsJ1 ? duelo.getJugador2() : duelo.getJugador1());
        aplicarEloYFinalizar(duelo, abandonadorEsJ1 ? 0.0 : 1.0, true);
        metrics.dueloLiveCompleted("walkover");
        emitirEstado(duelo, "OPPONENT_ABANDONED", "Walkover: " + reason);
    }

    private void aplicarEloYFinalizar(DueloLive duelo, double scoreJugador1, boolean walkover) {
        PvpEloService.PvpEloResult elo = pvpEloService.aplicarResultado(
                duelo.getJugador1(),
                duelo.getJugador2(),
                scoreJugador1,
                walkover);
        duelo.setJugador1EloBefore(elo.jugador1Before());
        duelo.setJugador2EloBefore(elo.jugador2Before());
        duelo.setJugador1EloAfter(elo.jugador1After());
        duelo.setJugador2EloAfter(elo.jugador2After());
        duelo.setEstado(walkover ? DueloLiveEstado.ABANDONED : DueloLiveEstado.FINISHED);
        duelo.setFinishedEn(now());
        usuarioRepository.save(duelo.getJugador1());
        if (duelo.getJugador2() != null) {
            usuarioRepository.save(duelo.getJugador2());
        }
        dueloRepository.save(duelo);
        String outcome = scoreJugador1 == 0.5 ? "draw" : (walkover ? "walkover" : "win");
        if (!walkover) metrics.dueloLiveCompleted(outcome);
        log.info("duelo_live_complete id={} outcome={} j1={} j2={} score={}-{} elo_delta_j1={} elo_delta_j2={} walkover={}",
                duelo.getId(),
                outcome,
                duelo.getJugador1().getUsername(),
                duelo.getJugador2() == null ? "BOT" : duelo.getJugador2().getUsername(),
                duelo.getScoreJugador1(),
                duelo.getScoreJugador2(),
                elo.jugador1Delta(),
                elo.jugador2Delta(),
                walkover);
    }

    private DueloLiveChoice decisionComunidad(DueloLiveRonda ronda) {
        long a = votoRepository.countByPersonajeId(ronda.getPersonajeA().getId());
        long b = votoRepository.countByPersonajeId(ronda.getPersonajeB().getId());
        if (a == 0 && b == 0) {
            return ronda.getPersonajeA().getId() <= ronda.getPersonajeB().getId()
                    ? DueloLiveChoice.A
                    : DueloLiveChoice.B;
        }
        if (a == b) return DueloLiveChoice.EMPATE;
        return a > b ? DueloLiveChoice.A : DueloLiveChoice.B;
    }

    private DueloLiveChoice votoBot(DueloLiveRonda ronda) {
        DueloLiveChoice correcta = decisionComunidad(ronda);
        if (correcta == DueloLiveChoice.EMPATE) {
            return votoRepository.countByPersonajeId(ronda.getPersonajeA().getId()) >=
                    votoRepository.countByPersonajeId(ronda.getPersonajeB().getId())
                    ? DueloLiveChoice.A
                    : DueloLiveChoice.B;
        }
        return correcta;
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

    private DueloLiveStateDto estadoPara(DueloLive duelo, Usuario usuario, String event, String message) {
        boolean soyJ1 = duelo.esJugador1(usuario);
        DueloLiveRonda activa = rondaRepository
                .findTopByDueloAndEstadoOrderByNumeroDesc(duelo, DueloLiveRondaEstado.IN_PROGRESS)
                .orElseGet(() -> rondaRepository.findByDueloIdDetalleDesc(duelo.getId()).stream().findFirst().orElse(null));
        int queuePosition = 0;
        if (duelo.getEstado() == DueloLiveEstado.WAITING) {
            List<DueloLive> esperando = dueloRepository.findWaitingOrderByCreadoEn();
            for (int i = 0; i < esperando.size(); i++) {
                if (esperando.get(i).getId().equals(duelo.getId())) {
                    queuePosition = i + 1;
                    break;
                }
            }
        }
        return DueloLiveStateDto.from(
                duelo,
                DueloLiveRoundDto.from(activa, now(), soyJ1),
                now(),
                soyJ1,
                queuePosition,
                event,
                message);
    }

    private void emitirEstado(DueloLive duelo, String event, String message) {
        if (duelo.getJugador1() != null) {
            messaging.convertAndSendToUser(duelo.getJugador1().getUsername(), "/queue/duelo",
                    estadoPara(duelo, duelo.getJugador1(), event, message));
        }
        if (duelo.getJugador2() != null) {
            messaging.convertAndSendToUser(duelo.getJugador2().getUsername(), "/queue/duelo",
                    estadoPara(duelo, duelo.getJugador2(), event, message));
        }
        messaging.convertAndSend("/topic/duelo/" + duelo.getId() + "/state",
                estadoPara(duelo, duelo.getJugador1(), event, message));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private static long elapsedMs(long startedNano) {
        return Math.max(0, (System.nanoTime() - startedNano) / 1_000_000);
    }
}
