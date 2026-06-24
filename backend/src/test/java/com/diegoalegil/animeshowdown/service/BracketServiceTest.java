package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;

/**
 * Contrato de generación del bracket (BracketService.crearBracket), sin cobertura
 * previa. Fija los invariantes estructurales: total de matches = N-1, ronda 1
 * emparejada en orden con personajes reales, rondas siguientes vacías, y el
 * rechazo de tamaños inválidos y de participantes duplicados (un personaje
 * repetido en slots no adyacentes acababa enfrentándose a sí mismo vía la
 * cascada — el dedup global lo previene).
 */
class BracketServiceTest {

    private EnfrentamientoRepository enfrentamientoRepository;
    private BracketService sut;
    private final Torneo torneo = mock(Torneo.class);

    @BeforeEach
    void setUp() {
        enfrentamientoRepository = mock(EnfrentamientoRepository.class);
        when(enfrentamientoRepository.save(any(Enfrentamiento.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        sut = new BracketService(enfrentamientoRepository);
        when(torneo.getSlug()).thenReturn("torneo-test");
    }

    private Personaje personaje(long id) {
        Personaje p = mock(Personaje.class);
        when(p.getId()).thenReturn(id);
        return p;
    }

    private List<Personaje> participantes(int n) {
        List<Personaje> lista = new ArrayList<>();
        for (int i = 1; i <= n; i++) lista.add(personaje(i));
        return lista;
    }

    @Test
    void creaLaCascadaCompletaConOchoParticipantes() {
        List<Enfrentamiento> bracket = sut.crearBracket(torneo, participantes(8));

        // 8 participantes → 4 + 2 + 1 = 7 matches en total (N-1).
        assertThat(bracket).hasSize(7);

        // Ronda 1: 4 matches con personajes reales.
        List<Enfrentamiento> ronda1 = bracket.stream().filter(e -> e.getRonda() == 1).toList();
        assertThat(ronda1).hasSize(4);
        assertThat(ronda1).allSatisfy(e -> {
            assertThat(e.getPersonaje1()).isNotNull();
            assertThat(e.getPersonaje2()).isNotNull();
        });

        // Rondas 2 y 3: matches vacíos (se rellenan por cascada al resolver).
        assertThat(bracket.stream().filter(e -> e.getRonda() == 2)).hasSize(2);
        assertThat(bracket.stream().filter(e -> e.getRonda() == 3)).hasSize(1);
        assertThat(bracket.stream().filter(e -> e.getRonda() >= 2))
                .allSatisfy(e -> {
                    assertThat(e.getPersonaje1()).isNull();
                    assertThat(e.getPersonaje2()).isNull();
                });
    }

    @Test
    void ronda1EmparejaPreservandoElOrdenDeEntrada() {
        List<Personaje> p = participantes(4); // ids 1,2,3,4
        List<Enfrentamiento> bracket = sut.crearBracket(torneo, p);

        List<Enfrentamiento> ronda1 = bracket.stream().filter(e -> e.getRonda() == 1).toList();
        assertThat(ronda1).hasSize(2);
        // match 0 = (0 vs 1), match 1 = (2 vs 3).
        assertThat(ronda1.get(0).getPersonaje1().getId()).isEqualTo(1L);
        assertThat(ronda1.get(0).getPersonaje2().getId()).isEqualTo(2L);
        assertThat(ronda1.get(1).getPersonaje1().getId()).isEqualTo(3L);
        assertThat(ronda1.get(1).getPersonaje2().getId()).isEqualTo(4L);
    }

    @Test
    void totalDeMatchesEsNmenos1() {
        assertThat(sut.crearBracket(torneo, participantes(4))).hasSize(3);
        assertThat(sut.crearBracket(torneo, participantes(16))).hasSize(15);
        assertThat(sut.crearBracket(torneo, participantes(32))).hasSize(31);
    }

    @Test
    void rechazaParticipantesDuplicadosAunqueNoSeanAdyacentes() {
        // Mismo id en posiciones 0 y 3 (no adyacentes): antes colaba y el ganador
        // de R1 se enfrentaba a sí mismo en R2.
        List<Personaje> p = new ArrayList<>(participantes(4));
        p.set(3, personaje(1)); // duplica el id 1
        assertThatThrownBy(() -> sut.crearBracket(torneo, p))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duplicados");
    }

    @Test
    void rechazaTamanoQueNoEsPotenciaDe2() {
        assertThatThrownBy(() -> sut.crearBracket(torneo, participantes(6)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("potencia de 2");
    }

    @Test
    void rechazaTamanoFueraDeRango() {
        assertThatThrownBy(() -> sut.crearBracket(torneo, participantes(2)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> sut.crearBracket(torneo, participantes(128)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void totalRondasEsLog2DelTamano() {
        assertThat(sut.totalRondas(4)).isEqualTo(2);
        assertThat(sut.totalRondas(8)).isEqualTo(3);
        assertThat(sut.totalRondas(64)).isEqualTo(6);
    }
}
