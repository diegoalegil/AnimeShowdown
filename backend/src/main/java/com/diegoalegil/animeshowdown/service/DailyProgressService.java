package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;
import java.util.function.Consumer;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.DailyProgressDto;
import com.diegoalegil.animeshowdown.model.DailyProgress;
import com.diegoalegil.animeshowdown.model.DailyStreak;
import com.diegoalegil.animeshowdown.repository.DailyProgressRepository;
import com.diegoalegil.animeshowdown.repository.DailyStreakRepository;

/**
 * Progreso de la misión diaria y racha SERVER-SIDE (#1 de la auditoría ultra).
 *
 * <p>La verdad vive aquí, no en localStorage: persiste, cruza dispositivos y
 * habilita notificaciones/leaderboards de racha. El día lo decide el
 * {@code Clock} del servidor (mismo bean que el resto del sistema diario), así
 * que cambiar el reloj del dispositivo no infla la racha. La acumulación de
 * votos usa lock pesimista contra lost-update, y la transición a "completado"
 * (y por tanto el incremento de racha) es idempotente por día.
 *
 * <p>Los votos los registra el {@code DailyProgressVoteListener} desde el evento
 * real de voto (autoritativo); juego y ranking-visto los reporta el cliente
 * (bajo valor de abuso para una racha, igual que el modelo de confianza previo).
 */
@Service
public class DailyProgressService {

    public static final int OBJETIVO_VOTOS = 10;
    public static final int OBJETIVO_JUEGOS = 1;

    private final DailyProgressRepository progressRepo;
    private final DailyStreakRepository streakRepo;
    private final Clock clock;

    public DailyProgressService(DailyProgressRepository progressRepo,
            DailyStreakRepository streakRepo,
            Clock clock) {
        this.progressRepo = progressRepo;
        this.streakRepo = streakRepo;
        this.clock = clock;
    }

    @Transactional
    public DailyProgressDto registrarVoto(Long usuarioId, int n) {
        int delta = Math.max(1, n);
        return mutar(usuarioId, p -> p.setVotos(p.getVotos() + delta));
    }

    @Transactional
    public DailyProgressDto marcarJuego(Long usuarioId) {
        return mutar(usuarioId, p -> {
            if (p.getJuegos() < OBJETIVO_JUEGOS) {
                p.setJuegos(p.getJuegos() + 1);
            }
        });
    }

    @Transactional
    public DailyProgressDto marcarRankingVisto(Long usuarioId) {
        return mutar(usuarioId, p -> p.setRankingVisto(true));
    }

    @Transactional(readOnly = true)
    public DailyProgressDto leer(Long usuarioId) {
        LocalDate hoy = LocalDate.now(clock);
        DailyProgress p = progressRepo.findByUsuarioIdAndFecha(usuarioId, hoy)
                .orElseGet(() -> new DailyProgress(usuarioId, hoy));
        return vista(usuarioId, p, hoy);
    }

    private DailyProgressDto mutar(Long usuarioId, Consumer<DailyProgress> mutacion) {
        LocalDate hoy = LocalDate.now(clock);
        DailyProgress p = obtenerConLock(usuarioId, hoy);
        mutacion.accept(p);
        p.tocar();
        boolean cumpleAhora = p.getVotos() >= OBJETIVO_VOTOS
                && p.getJuegos() >= OBJETIVO_JUEGOS
                && p.isRankingVisto();
        if (cumpleAhora && !p.isCompletado()) {
            p.setCompletado(true);
            actualizarRacha(usuarioId, hoy);
        }
        progressRepo.save(p);
        return vista(usuarioId, p, hoy);
    }

    /** Fila de hoy con lock; la crea si no existe, resolviendo la carrera de creación. */
    private DailyProgress obtenerConLock(Long usuarioId, LocalDate hoy) {
        Optional<DailyProgress> existente = progressRepo.lockByUsuarioYFecha(usuarioId, hoy);
        if (existente.isPresent()) {
            return existente.get();
        }
        try {
            return progressRepo.saveAndFlush(new DailyProgress(usuarioId, hoy));
        } catch (DataIntegrityViolationException carrera) {
            return progressRepo.lockByUsuarioYFecha(usuarioId, hoy).orElseThrow(() -> carrera);
        }
    }

    private void actualizarRacha(Long usuarioId, LocalDate hoy) {
        DailyStreak s = obtenerRachaConLock(usuarioId);
        // Idempotencia: si ya contamos hoy, no re-incrementar (carreras de doble
        // completado en el mismo instante).
        if (hoy.equals(s.getUltimaFechaCompletada())) {
            return;
        }
        boolean continua = hoy.minusDays(1).equals(s.getUltimaFechaCompletada());
        int actual = continua ? s.getActual() + 1 : 1;
        s.setActual(actual);
        s.setRecord(Math.max(s.getRecord(), actual));
        s.setUltimaFechaCompletada(hoy);
        streakRepo.save(s);
    }

    private DailyStreak obtenerRachaConLock(Long usuarioId) {
        Optional<DailyStreak> existente = streakRepo.lockByUsuario(usuarioId);
        if (existente.isPresent()) {
            return existente.get();
        }
        try {
            return streakRepo.saveAndFlush(new DailyStreak(usuarioId));
        } catch (DataIntegrityViolationException carrera) {
            return streakRepo.lockByUsuario(usuarioId).orElseThrow(() -> carrera);
        }
    }

    private DailyProgressDto vista(Long usuarioId, DailyProgress p, LocalDate hoy) {
        DailyStreak s = streakRepo.findById(usuarioId).orElse(null);
        int actual = rachaViva(s, hoy);
        int record = s == null ? 0 : s.getRecord();
        LocalDate ultima = s == null ? null : s.getUltimaFechaCompletada();
        return new DailyProgressDto(
                new DailyProgressDto.Progreso(
                        p.getFecha(), p.getVotos(), p.getJuegos(), p.isRankingVisto(), p.isCompletado()),
                new DailyProgressDto.Racha(actual, record, ultima));
    }

    /**
     * La racha solo sigue viva si la última jornada completada fue hoy o ayer
     * (mismo criterio que el frontend: un valor crudo mostraría "Racha: 5" falsa
     * tras saltarse días). No se persiste el reinicio: se corrige al completar la
     * siguiente jornada.
     */
    private int rachaViva(DailyStreak s, LocalDate hoy) {
        if (s == null || s.getUltimaFechaCompletada() == null) {
            return 0;
        }
        LocalDate ultima = s.getUltimaFechaCompletada();
        if (ultima.equals(hoy) || ultima.equals(hoy.minusDays(1))) {
            return s.getActual();
        }
        return 0;
    }
}
