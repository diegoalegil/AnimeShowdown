package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;

/**
 * Invariantes de {@code debeSalirEspecial}, hasta ahora solo cubiertos
 * indirectamente con RarezaService mockeado (CartaServiceTest):
 * <ul>
 *   <li>Pity duro: la especial está garantizada al acumular {@code pityDuro - 1}
 *       sobres sin especial. Un error de borde ({@code >= pityDuro} en vez de
 *       {@code >= pityDuro - 1}) rompería la garantía sin que ningún test lo
 *       detecte.</li>
 *   <li>Guard de catálogo: si no hay cartas ESPECIAL, nunca sale especial — ni
 *       con probabilidad 1.0 ni con el pity cumplido.</li>
 * </ul>
 * Se aísla el umbral fijando la probabilidad base a 0.0 (rama aleatoria siempre
 * false) o 1.0.
 */
class RarezaServiceTest {

    private RarezaService conProbabilidadYPity(double probabilidadBase, int pityDuro) {
        CartaRepository cartaRepo = mock(CartaRepository.class);
        when(cartaRepo.countByRareza(RarezaCarta.ESPECIAL)).thenReturn(5L); // hay especiales en catálogo
        return new RarezaService(cartaRepo, 100L, probabilidadBase, pityDuro);
    }

    @Test
    void pityDuroGarantizaEspecialJustoEnElUmbralNoAntes() {
        // probabilidad 0.0 → la rama aleatoria SIEMPRE es false; solo el pity
        // puede devolver true. Así el test fija exactamente el umbral.
        RarezaService sut = conProbabilidadYPity(0.0, 7);

        // Debajo del umbral (pityDuro-2 = 5): sin garantía → false.
        assertThat(sut.debeSalirEspecial(5)).as("un sobre antes del pity").isFalse();
        // Justo en el umbral (pityDuro-1 = 6): pity garantizado → true.
        assertThat(sut.debeSalirEspecial(6)).as("en el umbral del pity").isTrue();
        // Por encima del umbral: sigue garantizado.
        assertThat(sut.debeSalirEspecial(7)).isTrue();
        assertThat(sut.debeSalirEspecial(100)).isTrue();
    }

    @Test
    void sinPityLaProbabilidadCeroNuncaDaEspecial() {
        // Control negativo: con probabilidad 0 y sin alcanzar el pity, jamás sale
        // especial (descarta que algún borde garantice especial antes de tiempo).
        RarezaService sut = conProbabilidadYPity(0.0, 7);
        for (int sobresSinEspecial = 0; sobresSinEspecial <= 5; sobresSinEspecial++) {
            assertThat(sut.debeSalirEspecial(sobresSinEspecial))
                    .as("sobresSinEspecial=%d con prob 0 y pity 7", sobresSinEspecial)
                    .isFalse();
        }
    }

    @Test
    void probabilidadUnoSiempreDaEspecialAunSinPity() {
        // nextDouble() ∈ [0,1) siempre < 1.0 → la rama probabilística da true
        // incluso lejos del pity. Fija que la probabilidad base se respeta.
        RarezaService sut = conProbabilidadYPity(1.0, 7);
        assertThat(sut.debeSalirEspecial(0)).isTrue();
        assertThat(sut.debeSalirEspecial(3)).isTrue();
    }

    @Test
    void pityDuroDeUnoForzaEspecialDesdeElPrimerSobre() {
        // pityDuro=1 → pityDuro-1=0 → el primer sobre (sobresSinEspecial=0) ya
        // es pity. Borde inferior del clamp pityDuro=max(1,...).
        RarezaService sut = conProbabilidadYPity(0.0, 1);
        assertThat(sut.debeSalirEspecial(0)).isTrue();
    }

    @Test
    void sinCartasEspecialesEnCatalogoNuncaSaleEspecial() {
        // Guard de catálogo: countByRareza(ESPECIAL)=0 corta antes del pity y de
        // la probabilidad. Ni con prob 1.0 ni con pity inmediato sale especial
        // (si no, se concedería una carta inexistente).
        CartaRepository cartaRepo = mock(CartaRepository.class);
        when(cartaRepo.countByRareza(RarezaCarta.ESPECIAL)).thenReturn(0L);
        RarezaService sut = new RarezaService(cartaRepo, 100L, 1.0, 1);

        assertThat(sut.debeSalirEspecial(0)).isFalse();
        assertThat(sut.debeSalirEspecial(100)).isFalse();
    }

    @Test
    void exponePityDuroConfiguradoConClampMinimoUno() {
        assertThat(conProbabilidadYPity(0.20, 7).pityDuro()).isEqualTo(7);
        assertThat(conProbabilidadYPity(0.20, 0).pityDuro()).isEqualTo(1);
    }
}
