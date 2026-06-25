package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.DailyProgressDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Integración del progreso diario + racha server-side. Valida lo que importa:
 * acumulación persistida, transición a completado, idempotencia de la racha y
 * su rollover/reinicio por días, con el día controlado por un Clock mockeado.
 */
@SpringBootTest
@ActiveProfiles("test")
class DailyProgressServiceTest {

    @Autowired
    private DailyProgressService service;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @MockBean
    private Clock clock;

    private Long usuarioId;
    private Instant ahora;

    @BeforeEach
    void setUp() {
        ahora = LocalDate.of(2026, 6, 25).atStartOfDay(ZoneOffset.UTC).toInstant();
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        when(clock.instant()).thenAnswer(inv -> ahora);
        String semilla = "racha_" + ahora.getNano() + "_" + System.nanoTime();
        usuarioId = usuarioRepository.save(new Usuario(semilla, "hash", semilla + "@example.com")).getId();
    }

    private void avanzarDias(int dias) {
        ahora = ahora.plus(dias, ChronoUnit.DAYS);
    }

    private DailyProgressDto completarHoy() {
        service.registrarVoto(usuarioId, DailyProgressService.OBJETIVO_VOTOS);
        service.marcarJuego(usuarioId);
        return service.marcarRankingVisto(usuarioId);
    }

    @Test
    void acumulaVotosSinCompletar() {
        DailyProgressDto vista = null;
        for (int i = 0; i < DailyProgressService.OBJETIVO_VOTOS; i++) {
            vista = service.registrarVoto(usuarioId, 1);
        }
        assertThat(vista.progreso().votos()).isEqualTo(DailyProgressService.OBJETIVO_VOTOS);
        assertThat(vista.progreso().completado()).isFalse();
        assertThat(vista.racha().actual()).isZero();
    }

    @Test
    void completarLosTresPasosCompletaLaMisionYEnciendeLaRacha() {
        DailyProgressDto vista = completarHoy();
        assertThat(vista.progreso().completado()).isTrue();
        assertThat(vista.racha().actual()).isEqualTo(1);
        assertThat(vista.racha().record()).isEqualTo(1);
    }

    @Test
    void completarConDosPasosNoCompleta() {
        service.registrarVoto(usuarioId, DailyProgressService.OBJETIVO_VOTOS);
        DailyProgressDto vista = service.marcarJuego(usuarioId);
        // Falta revisar el ranking.
        assertThat(vista.progreso().completado()).isFalse();
        assertThat(vista.racha().actual()).isZero();
    }

    @Test
    void completarEsIdempotenteParaLaRacha() {
        completarHoy();
        // Más votos el mismo día no re-incrementan la racha.
        DailyProgressDto vista = service.registrarVoto(usuarioId, 5);
        assertThat(vista.racha().actual()).isEqualTo(1);
    }

    @Test
    void marcarJuegoEsIdempotentePorDia() {
        service.marcarJuego(usuarioId);
        service.marcarJuego(usuarioId);
        DailyProgressDto vista = service.marcarJuego(usuarioId);
        assertThat(vista.progreso().juegos()).isEqualTo(DailyProgressService.OBJETIVO_JUEGOS);
    }

    @Test
    void rachaContinuaEnDiasConsecutivos() {
        completarHoy();
        avanzarDias(1);
        DailyProgressDto vista = completarHoy();
        assertThat(vista.racha().actual()).isEqualTo(2);
        assertThat(vista.racha().record()).isEqualTo(2);
    }

    @Test
    void rachaSeReiniciaTrasSaltarUnDia() {
        completarHoy();
        avanzarDias(2); // se salta un día
        DailyProgressDto vista = completarHoy();
        assertThat(vista.racha().actual()).isEqualTo(1);
        // El récord histórico no baja.
        assertThat(vista.racha().record()).isEqualTo(1);
    }

    @Test
    void rachaMuertaSeLeeComoCeroSinPerderElRecord() {
        completarHoy(); // racha 1
        avanzarDias(2); // hoy la última completada es anteayer → racha muerta
        DailyProgressDto vista = service.leer(usuarioId);
        assertThat(vista.racha().actual()).isZero();
        assertThat(vista.racha().record()).isEqualTo(1);
    }

    @Test
    void leerSinProgresoDevuelveDiaVacio() {
        DailyProgressDto vista = service.leer(usuarioId);
        assertThat(vista.progreso().votos()).isZero();
        assertThat(vista.progreso().completado()).isFalse();
        assertThat(vista.racha().actual()).isZero();
    }

    @Test
    void votoConFechaSelladaNoSeCuentaEnElDiaEquivocado() {
        // Un voto sellado con la fecha de AYER (procesado @Async ya cruzada la
        // medianoche) cuenta en AYER, no en HOY: hoy sigue a cero.
        service.registrarVoto(usuarioId, LocalDate.of(2026, 6, 24), 3);
        assertThat(service.leer(usuarioId).progreso().votos()).isZero();
    }

    @Test
    void completadoTardioDeUnDiaAnteriorNoRetrocedeNiMataLaRachaViva() {
        // Regresión (interacción del sellado de fechaVoto + listener @Async): un
        // voto sellado de un día ANTERIOR, procesado tras haber completado días
        // posteriores, completaría ese día viejo y —sin la guarda en
        // actualizarRacha— retrocedería ultimaFechaCompletada, matando la racha
        // viva. Montaje: progreso parcial el 06-23; racha 2 con 06-24+06-25; luego
        // llega el voto tardío que completa el 06-23. La racha debe seguir en 2.
        LocalDate d23 = LocalDate.of(2026, 6, 23);
        LocalDate d24 = LocalDate.of(2026, 6, 24);
        LocalDate d25 = LocalDate.of(2026, 6, 25);

        // 06-23: parcial (juego + ranking + votos < objetivo) → NO completa.
        ahora = d23.atStartOfDay(ZoneOffset.UTC).toInstant();
        service.marcarJuego(usuarioId);
        service.marcarRankingVisto(usuarioId);
        service.registrarVoto(usuarioId, DailyProgressService.OBJETIVO_VOTOS - 1);

        // 06-24 y 06-25 completos y consecutivos → racha 2, última = 06-25.
        ahora = d24.atStartOfDay(ZoneOffset.UTC).toInstant();
        completarHoy();
        ahora = d25.atStartOfDay(ZoneOffset.UTC).toInstant();
        assertThat(completarHoy().racha().actual()).isEqualTo(2);

        // Voto TARDÍO sellado el 06-23 (cruzó medianoche) que ahora lo completa.
        service.registrarVoto(usuarioId, d23, 1);

        // La racha viva NO retrocede ni muere: sigue en 2 con última = 06-25.
        DailyProgressDto vista = service.leer(usuarioId);
        assertThat(vista.racha().actual()).isEqualTo(2);
        assertThat(vista.racha().record()).isEqualTo(2);
    }

    // ─── migrarRacha (semilla única de la racha local) ───────────────────────

    @Test
    void migrarRachaSiembraLaRachaLocalVivaCuandoElServidorNoTiene() {
        // Racha local viva (última = hoy), servidor sin historial → la adopta.
        DailyProgressDto vista = service.migrarRacha(
                usuarioId, 5, LocalDate.of(2026, 6, 25), LocalDate.of(2026, 6, 1));
        assertThat(vista.racha().actual()).isEqualTo(5);
        assertThat(vista.racha().record()).isEqualTo(5);
    }

    @Test
    void migrarRachaCapaPorAntiguedadDeLaCuenta() {
        // Reclama 100 pero la cuenta tiene 2 días (registro ayer) → capa a 2.
        DailyProgressDto vista = service.migrarRacha(
                usuarioId, 100, LocalDate.of(2026, 6, 25), LocalDate.of(2026, 6, 24));
        assertThat(vista.racha().actual()).isEqualTo(2);
    }

    @Test
    void migrarRachaNoImportaUnaRachaMuerta() {
        // Última jornada local anterior a ayer → muerta → no se importa.
        DailyProgressDto vista = service.migrarRacha(
                usuarioId, 9, LocalDate.of(2026, 6, 20), LocalDate.of(2026, 6, 1));
        assertThat(vista.racha().actual()).isZero();
    }

    @Test
    void migrarRachaEsNoOpSiElServidorYaTieneRacha() {
        completarHoy(); // racha server = 1
        DailyProgressDto vista = service.migrarRacha(
                usuarioId, 99, LocalDate.of(2026, 6, 25), LocalDate.of(2026, 6, 1));
        // No pisa la racha real del servidor.
        assertThat(vista.racha().actual()).isEqualTo(1);
    }
}
