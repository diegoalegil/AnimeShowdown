package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.function.Consumer;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.DailyProgressDto;
import com.diegoalegil.animeshowdown.model.DailyProgress;
import com.diegoalegil.animeshowdown.model.DailyStreak;
import com.diegoalegil.animeshowdown.repository.DailyProgressRepository;
import com.diegoalegil.animeshowdown.repository.DailyStreakRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

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
    private final UsuarioRepository usuarioRepo;
    private final Clock clock;

    public DailyProgressService(DailyProgressRepository progressRepo,
            DailyStreakRepository streakRepo,
            UsuarioRepository usuarioRepo,
            Clock clock) {
        this.progressRepo = progressRepo;
        this.streakRepo = streakRepo;
        this.usuarioRepo = usuarioRepo;
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

    /**
     * Semilla ÚNICA de la racha local al servidor (migración a server-side, #1).
     * Sin esto, la racha viva de cada usuario existente se ponía a 0 en el primer
     * login (el servidor arranca sin historial). El servidor es el guardián:
     * <ul>
     *   <li>solo si AÚN no hay racha en el servidor (one-time; nunca pisa una real);</li>
     *   <li>solo si la racha local está VIVA (última jornada hoy o ayer); una más
     *       antigua ya está muerta y no se importa;</li>
     *   <li>capando {@code actual} a los días desde el registro (una racha no
     *       puede ser más larga que la antigüedad de la cuenta) — así no se
     *       infla ni contamina futuros leaderboards.</li>
     * </ul>
     * No-op idempotente en cualquier otro caso; devuelve siempre la vista actual.
     */
    @Transactional
    public DailyProgressDto migrarRacha(Long usuarioId, int actualReclamado,
            LocalDate ultimaLocal, LocalDate fechaRegistro) {
        LocalDate hoy = LocalDate.now(clock);
        boolean viva = ultimaLocal != null
                && (ultimaLocal.equals(hoy) || ultimaLocal.equals(hoy.minusDays(1)));
        if (viva) {
            DailyStreak s = obtenerRachaConLock(usuarioId);
            boolean servidorSinHistorial =
                    s.getUltimaFechaCompletada() == null && s.getActual() == 0;
            if (servidorSinHistorial) {
                int tope = capPorAntiguedad(fechaRegistro, hoy);
                int actual = Math.min(Math.max(1, actualReclamado), tope);
                s.setActual(actual);
                s.setRecord(Math.max(s.getRecord(), actual));
                s.setUltimaFechaCompletada(ultimaLocal);
                streakRepo.save(s);
            }
        }
        return leer(usuarioId);
    }

    /** Tope = días desde el registro (inclusive), acotado a [1, 3650]. */
    private int capPorAntiguedad(LocalDate fechaRegistro, LocalDate hoy) {
        if (fechaRegistro == null) {
            return 1;
        }
        long dias = java.time.temporal.ChronoUnit.DAYS.between(fechaRegistro, hoy) + 1;
        return (int) Math.max(1, Math.min(3650, dias));
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

    /**
     * Fila de hoy con lock; la crea si no existe. Para resolver la carrera de
     * creación bloquea PRIMERO la fila del usuario (patrón de
     * {@code MonederoService.obtenerOCrearConLock}) en vez de capturar una
     * violación de unique tras el INSERT: en Postgres real esa violación aborta
     * TODA la transacción y el re-query del catch fallaría con "current
     * transaction is aborted" (H2 no aborta, por eso solo se veía en prod). Con
     * el lock del padre los creadores concurrentes se serializan ANTES del
     * INSERT, así que el segundo encuentra la fila ya creada sin tocar el unique.
     */
    private DailyProgress obtenerConLock(Long usuarioId, LocalDate hoy) {
        usuarioRepo.findForUpdateById(usuarioId);
        return progressRepo.lockByUsuarioYFecha(usuarioId, hoy)
                .orElseGet(() -> progressRepo.saveAndFlush(new DailyProgress(usuarioId, hoy)));
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

    /** Racha con lock; misma defensa que {@link #obtenerConLock}: bloquea la fila
     * del usuario antes del INSERT en vez de capturar la violación de unique. */
    private DailyStreak obtenerRachaConLock(Long usuarioId) {
        usuarioRepo.findForUpdateById(usuarioId);
        return streakRepo.lockByUsuario(usuarioId)
                .orElseGet(() -> streakRepo.saveAndFlush(new DailyStreak(usuarioId)));
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
