package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BracketAdvanceServiceTest {

    @Mock private EnfrentamientoRepository enfrentamientoRepository;
    @Mock private VotoRepository votoRepository;
    @Mock private TorneoRepository torneoRepository;

    private BracketAdvanceService service;

    @BeforeEach
    void setUp() {
        service = new BracketAdvanceService(
                enfrentamientoRepository, votoRepository, torneoRepository);
    }

    // ─── Fixtures ──────────────────────────────────────────────────────────────

    private static PersonaBuilder p(Long id) { return new PersonaBuilder(id); }
    private static class PersonaBuilder {
        private final Personaje p = new Personaje();
        PersonaBuilder(Long id) { p.setId(id); p.setSlug("p" + id); p.setNombre("P" + id); }
        Personaje build() { return p; }
    }

    private static Enfrentamiento enf(Long id, int ronda, Personaje p1, Personaje p2, Torneo t) {
        Enfrentamiento e = new Enfrentamiento();
        e.setId(id);
        e.setRonda(ronda);
        e.setPersonaje1(p1);
        e.setPersonaje2(p2);
        e.setTorneo(t);
        return e;
    }

    private static Enfrentamiento enfSinGanador(Long id, int ronda, Personaje p1, Personaje p2, Torneo t) {
        Enfrentamiento e = new Enfrentamiento();
        e.setId(id);
        e.setRonda(ronda);
        e.setPersonaje1(p1);
        e.setPersonaje2(p2);
        e.setTorneo(t);
        return e;
    }

    private static Enfrentamiento enfConGanador(Long id, int ronda, Personaje p1, Personaje p2, Personaje ganador, Torneo t) {
        Enfrentamiento e = new Enfrentamiento();
        e.setId(id);
        e.setRonda(ronda);
        e.setPersonaje1(p1);
        e.setPersonaje2(p2);
        e.setGanador(ganador);
        e.setTorneo(t);
        return e;
    }

    private static Enfrentamiento enfVacio(Long id, int ronda, Torneo t) {
        Enfrentamiento e = new Enfrentamiento();
        e.setId(id);
        e.setRonda(ronda);
        e.setTorneo(t);
        return e;
    }

    private static Torneo makeTorneo(Long id, String slug) {
        Torneo t = new Torneo();
        t.setId(id);
        t.setSlug(slug);
        t.setEstado(EstadoTorneo.IN_PROGRESS);
        return t;
    }

    // ─── cerrarRondaYAvanzar ────────────────────────────────────────────────────

    @Nested
    class CerrarRondaYAvanzar {

        @Test
        void retornaSinCambiosCuandoNoHayEnfrentamientos() {
            Torneo t = makeTorneo(1L, "test");
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of());

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.SIN_CAMBIOS);
        }

        @Test
        void retornaSinCambiosCuandoTodosLosMatchesYaTienenGanadorYTorneoFinished() {
            // When all matches have winners and the tournament is already FINISHED,
            // finalizeSiCorresponde returns SIN_CAMBIOS (no state change needed).
            Torneo t = makeTorneo(1L, "test");
            t.setEstado(EstadoTorneo.FINISHED);
            Personaje gan = p(1L).build();
            Enfrentamiento e1 = enfConGanador(1L, 1, p(2L).build(), p(3L).build(), gan, t);
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1));

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.SIN_CAMBIOS);
        }

        @Test
        void retornaTorneoFinalizadoCuandoTodosLosMatchesYaTienenGanadorYTorneoInProgress() {
            // When all matches have winners and tournament is IN_PROGRESS,
            // finalizeSiCorresponde marks it FINISHED and returns TORNEO_FINALIZADO.
            Torneo t = makeTorneo(1L, "test");
            // state is already IN_PROGRESS from makeTorneo
            Personaje gan = p(1L).build();
            Enfrentamiento e1 = enfConGanador(1L, 1, p(2L).build(), p(3L).build(), gan, t);
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1));
            lenient().when(torneoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.TORNEO_FINALIZADO);
            assertThat(t.getEstado()).isEqualTo(EstadoTorneo.FINISHED);
            assertThat(t.getGanadorPersonaje()).isEqualTo(gan);
        }

        @Test
        void retornaSinCambiosCuandoUnMatchNoTienePersonajes() {
            Torneo t = makeTorneo(1L, "test");
            Personaje pp1 = p(1L).build();
            Personaje pp2 = p(2L).build();
            Enfrentamiento e1 = enfSinGanador(1L, 1, pp1, pp2, t); // completo
            Enfrentamiento e2 = enfVacio(2L, 1, t);                 // vacío
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1, e2));

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.SIN_CAMBIOS);
            verify(enfrentamientoRepository, never()).save(any(Enfrentamiento.class));
        }

        @Test
        void retornaSinCambiosCuandoUnMatchNoTieneVotos() {
            Torneo t = makeTorneo(1L, "test");
            Personaje pp1 = p(1L).build();
            Personaje pp2 = p(2L).build();
            Enfrentamiento e1 = enfSinGanador(1L, 1, pp1, pp2, t);
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1));
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp1)).thenReturn(0.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp2)).thenReturn(0.0);

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.SIN_CAMBIOS);
            verify(enfrentamientoRepository, never()).save(any(Enfrentamiento.class));
        }

        @Test
        void desempataEmpateConVotosPorScoreGlobal() {
            Torneo t = makeTorneo(1L, "test");
            Personaje pp1 = p(1L).build();
            Personaje pp2 = p(2L).build();
            Enfrentamiento e1 = enfSinGanador(1L, 1, pp1, pp2, t);
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1));
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp1)).thenReturn(5.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp2)).thenReturn(5.0);
            when(votoRepository.sumaPesoByPersonajeId(pp1.getId())).thenReturn(4.0);
            when(votoRepository.sumaPesoByPersonajeId(pp2.getId())).thenReturn(9.0);
            lenient().when(torneoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.TORNEO_FINALIZADO);
            assertThat(e1.getGanador()).isEqualTo(pp2);
            assertThat(t.getGanadorPersonaje()).isEqualTo(pp2);
        }

        @Test
        void desempataEmpateConVotosPorOrdenDeBracketSiScoreGlobalTambienEmpata() {
            Torneo t = makeTorneo(1L, "test");
            Personaje pp1 = p(1L).build();
            Personaje pp2 = p(2L).build();
            Enfrentamiento e1 = enfSinGanador(1L, 1, pp1, pp2, t);
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1));
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp1)).thenReturn(3.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp2)).thenReturn(3.0);
            when(votoRepository.sumaPesoByPersonajeId(pp1.getId())).thenReturn(7.0);
            when(votoRepository.sumaPesoByPersonajeId(pp2.getId())).thenReturn(7.0);
            lenient().when(torneoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.TORNEO_FINALIZADO);
            assertThat(e1.getGanador()).isEqualTo(pp1);
            assertThat(t.getGanadorPersonaje()).isEqualTo(pp1);
        }

        @Test
        void retornaSinCambiosCuandoBracketSiguienteTieneTamanoInconsistente() {
            // e1: 1 match en ronda 1. siguiente (ronda 2) tiene 1 match.
            // matches.size()/2 = 1/2 = 0 (integer) != 1 → SIN_CAMBIOS.
            Torneo t = makeTorneo(1L, "test");
            Personaje pp1 = p(1L).build();
            Personaje pp2 = p(2L).build();
            Enfrentamiento e1 = enfSinGanador(1L, 1, pp1, pp2, t);
            Enfrentamiento e2 = enfVacio(2L, 2, t); // size=1 pero e1.size/2=0 esperado
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1, e2));
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp1)).thenReturn(10.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp2)).thenReturn(2.0);

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.SIN_CAMBIOS);
        }

        @Test
        void avanzaYGanadorPropagaASiguienteRondaSlotPersonaje1Y2() {
            // Ronda 1: i=0 (pp1 vs pp2) → pp1 gana → dst[0].personaje1 = pp1
            //           i=1 (pp3 vs pp4) → pp3 gana → dst[0].personaje2 = pp3
            Torneo t = makeTorneo(1L, "test");
            Personaje pp1 = p(1L).build();
            Personaje pp2 = p(2L).build();
            Personaje pp3 = p(3L).build();
            Personaje pp4 = p(4L).build();
            Enfrentamiento e1 = enfSinGanador(1L, 1, pp1, pp2, t); // i=0
            Enfrentamiento e2 = enfSinGanador(2L, 1, pp3, pp4, t); // i=1
            Enfrentamiento dst = enfVacio(3L, 2, t);               // siguiente ronda
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1, e2, dst));
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp1)).thenReturn(10.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp2)).thenReturn(2.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e2, pp3)).thenReturn(7.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e2, pp4)).thenReturn(3.0);

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.AVANZADA);
            assertThat(e1.getGanador()).isEqualTo(pp1);
            assertThat(e2.getGanador()).isEqualTo(pp3);
            assertThat(dst.getPersonaje1()).isEqualTo(pp1); // i=0 even → personaje1
            assertThat(dst.getPersonaje2()).isEqualTo(pp3); // i=1 odd → personaje2
        }

        @Test
        void ultimaRondaFinalizaTorneoYGanador() {
            Torneo t = makeTorneo(1L, "test");
            Personaje pp1 = p(1L).build(); // gana
            Personaje pp2 = p(2L).build();
            Enfrentamiento e1 = enfSinGanador(1L, 1, pp1, pp2, t);
            when(enfrentamientoRepository.findByTorneoOrderByRondaAscIdAsc(t))
                    .thenReturn(List.of(e1));
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp1)).thenReturn(15.0);
            when(votoRepository.scoreByEnfrentamientoAndPersonaje(e1, pp2)).thenReturn(3.0);
            lenient().when(torneoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            var result = service.cerrarRondaYAvanzar(t);

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.TORNEO_FINALIZADO);
            assertThat(e1.getGanador()).isEqualTo(pp1);
            assertThat(t.getEstado()).isEqualTo(EstadoTorneo.FINISHED);
            assertThat(t.getGanadorPersonaje()).isEqualTo(pp1);
            verify(torneoRepository).save(t);
        }
    }

    // ─── cerrarTodasLasRondas ─────────────────────────────────────────────────

    @Nested
    class CerrarTodasLasRondas {

        /**
         * Injects spy as the self-proxy field so that self.cerrarRondaYAvanzar()
         * dispatches to the spy (enabling stubbing of the recursive call).
         */
        private BracketAdvanceService spyWithSelf() throws Exception {
            BracketAdvanceService spy = Mockito.spy(service);
            Field selfField = BracketAdvanceService.class.getDeclaredField("self");
            selfField.setAccessible(true);
            selfField.set(spy, spy);
            return spy;
        }

        @Test
        void retornaTorneoFinalizadoEnPrimeraLlamada() throws Exception {
            BracketAdvanceService spy = spyWithSelf();
            doReturn(BracketAdvanceService.Resultado.TORNEO_FINALIZADO)
                    .when(spy).cerrarRondaYAvanzar(any());

            var result = spy.cerrarTodasLasRondas(makeTorneo(1L, "test"));

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.TORNEO_FINALIZADO);
        }

        @Test
        void retornaSinCambiosCuandoNadaCambia() throws Exception {
            BracketAdvanceService spy = spyWithSelf();
            doReturn(BracketAdvanceService.Resultado.SIN_CAMBIOS)
                    .when(spy).cerrarRondaYAvanzar(any());

            var result = spy.cerrarTodasLasRondas(makeTorneo(1L, "test"));

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.SIN_CAMBIOS);
        }

        @Test
        void retornaAvanzadaCuandoProgresaYLuegoNoCambia() throws Exception {
            BracketAdvanceService spy = spyWithSelf();
            doReturn(BracketAdvanceService.Resultado.AVANZADA)
                    .doReturn(BracketAdvanceService.Resultado.SIN_CAMBIOS)
                    .when(spy).cerrarRondaYAvanzar(any());

            var result = spy.cerrarTodasLasRondas(makeTorneo(1L, "test"));

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.AVANZADA);
        }

        @Test
        void detieneEnMaxRondasYLlama9Veces() throws Exception {
            BracketAdvanceService spy = spyWithSelf();
            // Always returns AVANZADA — should stop at MAX_RONDAS=9
            doReturn(BracketAdvanceService.Resultado.AVANZADA)
                    .when(spy).cerrarRondaYAvanzar(any());

            var result = spy.cerrarTodasLasRondas(makeTorneo(1L, "test"));

            assertThat(result).isEqualTo(BracketAdvanceService.Resultado.AVANZADA);
            verify(spy, Mockito.times(9)).cerrarRondaYAvanzar(any());
        }
    }
}
