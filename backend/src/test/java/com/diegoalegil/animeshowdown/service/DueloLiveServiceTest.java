package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.reset;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.DueloLiveStateDto;
import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveChoice;
import com.diegoalegil.animeshowdown.model.DueloLiveEstado;
import com.diegoalegil.animeshowdown.model.DueloLiveRonda;
import com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.DueloLiveRepository;
import com.diegoalegil.animeshowdown.repository.DueloLiveRondaRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@SpringBootTest
@ActiveProfiles("test")
class DueloLiveServiceTest {

    @Autowired private DueloLiveService dueloLiveService;
    @Autowired private DueloLiveRepository dueloRepository;
    @Autowired private DueloLiveRondaRepository rondaRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private VotoRepository votoRepository;
    @Autowired private MutableTestClock clock;

    @MockitoBean private SimpMessagingTemplate messaging;

    @BeforeEach
    void limpiar() {
        rondaRepository.deleteAll();
        dueloRepository.deleteAll();
        reset(messaging);
        clock.setInstant(Instant.parse("2026-05-22T10:00:00Z"));
    }

    @Test
    void matchmakingEmparejaDosUsuariosConEloPvpCercano() {
        Usuario a = usuario("pvp_match_a", 1010);
        Usuario b = usuario("pvp_match_b", 1060);

        DueloLiveStateDto waiting = dueloLiveService.entrarCola(a, "10.0.0.1");
        DueloLiveStateDto matched = dueloLiveService.entrarCola(b, "10.0.0.2");

        assertThat(waiting.estado()).isEqualTo(DueloLiveEstado.WAITING);
        assertThat(matched.estado()).isEqualTo(DueloLiveEstado.IN_PROGRESS);
        assertThat(matched.rival().username()).isEqualTo("pvp_match_a");
        assertThat(Math.abs(matched.miEloBefore() - matched.rivalEloBefore())).isLessThanOrEqualTo(100);
    }

    @Test
    void completaMatchBestOfFiveYActualizaSoloEloPvp() {
        Usuario winner = usuario("pvp_winner", 1000);
        Usuario loser = usuario("pvp_loser", 1000);
        dueloLiveService.entrarCola(winner, "10.0.1.1");
        DueloLiveStateDto state = dueloLiveService.entrarCola(loser, "10.0.1.2");

        while (state.estado() == DueloLiveEstado.IN_PROGRESS) {
            avanzarApertura(state);
            asegurarDecisionA(state);
            dueloLiveService.votar(state.id(), winner, DueloLiveChoice.A);
            dueloLiveService.votar(state.id(), loser, DueloLiveChoice.B);
            state = dueloLiveService.estado(state.id(), winner);
        }

        Usuario winnerReloaded = usuarioRepository.findByUsername("pvp_winner").orElseThrow();
        Usuario loserReloaded = usuarioRepository.findByUsername("pvp_loser").orElseThrow();
        assertThat(state.estado()).isEqualTo(DueloLiveEstado.FINISHED);
        assertThat(state.miScore()).isGreaterThan(state.rivalScore());
        assertThat(winnerReloaded.getEloPvp()).isGreaterThan(1000);
        assertThat(loserReloaded.getEloPvp()).isLessThan(1000);
        assertThat(winnerReloaded.getPvpPartidos()).isEqualTo(1);
        assertThat(loserReloaded.getPvpPartidos()).isEqualTo(1);
    }

    @Test
    void abandonoAMitadConcedeWalkoverYPenalizaDobleAlAbandonador() {
        Usuario a = usuario("pvp_leave_a", 1000);
        Usuario b = usuario("pvp_leave_b", 1000);
        dueloLiveService.entrarCola(a, "10.0.2.1");
        DueloLiveStateDto match = dueloLiveService.entrarCola(b, "10.0.2.2");

        DueloLiveStateDto abandoned = dueloLiveService.abandonar(match.id(), a);

        Usuario aReloaded = usuarioRepository.findByUsername("pvp_leave_a").orElseThrow();
        Usuario bReloaded = usuarioRepository.findByUsername("pvp_leave_b").orElseThrow();
        assertThat(abandoned.estado()).isEqualTo(DueloLiveEstado.ABANDONED);
        assertThat(aReloaded.getEloPvp()).isLessThan(1000 - 16);
        assertThat(bReloaded.getEloPvp()).isGreaterThan(1000);
    }

    @Test
    @Transactional
    void empateHistoricoHaceRondaNulaYNoMueveScores() {
        Usuario a = usuario("pvp_tie_a", 1000);
        Usuario b = usuario("pvp_tie_b", 1000);
        Personaje p1 = personajeRepository.save(new Personaje("pvp_tie_a", "Tie A", "Test", "sin votos", "/img/tie-a.webp"));
        Personaje p2 = personajeRepository.save(new Personaje("pvp_tie_b", "Tie B", "Test", "sin votos", "/img/tie-b.webp"));

        DueloLive duelo = new DueloLive(a, "10.0.3.1", LocalDateTime.now(clock));
        duelo.setJugador2(b);
        duelo.setJugador2Ip("10.0.3.2");
        duelo.setEstado(DueloLiveEstado.IN_PROGRESS);
        duelo.setMatchedEn(LocalDateTime.now(clock));
        duelo.setStartedEn(LocalDateTime.now(clock));
        duelo.setRondaActual(1);
        duelo = dueloRepository.save(duelo);
        rondaRepository.save(new DueloLiveRonda(
                duelo, 1, p1, p2,
                LocalDateTime.now(clock),
                LocalDateTime.now(clock).plusSeconds(12)));

        dueloLiveService.votar(duelo.getId(), a, DueloLiveChoice.A);
        DueloLiveStateDto state = dueloLiveService.votar(duelo.getId(), b, DueloLiveChoice.B);

        List<DueloLiveRonda> rondas = rondaRepository.findByDueloIdDetalleDesc(duelo.getId());
        assertThat(rondas).anyMatch(r -> r.getEstado() == DueloLiveRondaEstado.VOID);
        assertThat(state.miScore()).isZero();
        assertThat(state.rivalScore()).isZero();
        assertThat(rondas.get(0).getEstado()).isEqualTo(DueloLiveRondaEstado.IN_PROGRESS);
    }

    @Test
    void backendHaceCumplirVentanaDeDoceSegundosDeRonda() {
        Usuario a = usuario("pvp_window_a", 1000);
        Usuario b = usuario("pvp_window_b", 1000);
        dueloLiveService.entrarCola(a, "10.0.4.1");
        DueloLiveStateDto state = dueloLiveService.entrarCola(b, "10.0.4.2");

        assertThatThrownBy(() -> dueloLiveService.votar(state.id(), a, DueloLiveChoice.A))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("todavía no está abierta");

        clock.setInstant(state.ronda().cierraEn().toInstant(ZoneOffset.UTC).plusSeconds(1));

        assertThatThrownBy(() -> dueloLiveService.votar(state.id(), a, DueloLiveChoice.A))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ya cerró");
    }

    @Test
    void activaBotFallbackSiNoHayRivalTrasTreintaSegundos() {
        Usuario a = usuario("pvp_bot_a", 1000);
        DueloLiveStateDto waiting = dueloLiveService.entrarCola(a, "10.0.5.1");

        clock.setInstant(Instant.parse("2026-05-22T10:00:31Z"));
        dueloLiveService.mantenimientoLive();

        DueloLiveStateDto state = dueloLiveService.estado(waiting.id(), a);
        assertThat(state.estado()).isEqualTo(DueloLiveEstado.IN_PROGRESS);
        assertThat(state.botMatch()).isTrue();
        assertThat(state.rival().bot()).isTrue();
    }

    private void asegurarDecisionA(DueloLiveStateDto state) {
        long aId = state.ronda().personajeA().getId();
        long bId = state.ronda().personajeB().getId();
        long aCount = votoRepository.countByPersonajeId(aId);
        long bCount = votoRepository.countByPersonajeId(bId);
        Personaje a = personajeRepository.findById(aId).orElseThrow();
        for (long i = aCount; i <= bCount; i++) {
            votoRepository.save(new Voto(a));
        }
    }

    private Usuario usuario(String username, int eloPvp) {
        return usuarioRepository.findByUsername(username).orElseGet(() -> {
            Usuario u = new Usuario(username, "{noop}secreta123", username + "@example.com");
            u.setEstadoVerificacion(EstadoVerificacion.ACTIVO);
            u.setRol(Rol.USER);
            u.setEloPvp(eloPvp);
            return usuarioRepository.save(u);
        });
    }

    private void avanzarApertura(DueloLiveStateDto state) {
        clock.setInstant(state.ronda().abreEn().toInstant(ZoneOffset.UTC).plusMillis(1));
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        @Primary
        MutableTestClock mutableTestClock() {
            return new MutableTestClock();
        }

    }

    static class MutableTestClock extends Clock {
        private final AtomicReference<Instant> instant = new AtomicReference<>(Instant.parse("2026-05-22T10:00:00Z"));

        void setInstant(Instant instant) {
            this.instant.set(instant);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant.get();
        }
    }
}
