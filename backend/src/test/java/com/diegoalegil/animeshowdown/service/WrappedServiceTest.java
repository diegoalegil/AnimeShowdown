package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.dto.WrappedDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PrediccionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioLogroRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

@ExtendWith(MockitoExtension.class)
class WrappedServiceTest {

    @Mock private VotoRepository votoRepository;
    @Mock private PrediccionRepository prediccionRepository;
    @Mock private UsuarioLogroRepository usuarioLogroRepository;

    private WrappedService service() {
        return new WrappedService(votoRepository, prediccionRepository, usuarioLogroRepository);
    }

    private TopPersonajeItem item(String slug, String anime, double votos) {
        return new TopPersonajeItem(1L, slug, slug, "/img/" + slug + ".webp", anime, votos);
    }

    @Test
    void agregaActividadYDerivaFandomPrincipal() {
        Usuario u = mock(Usuario.class);
        when(u.getUsername()).thenReturn("diego");
        when(u.getPvpPartidos()).thenReturn(10);
        when(votoRepository.countByUsuario(u)).thenReturn(42L);
        when(prediccionRepository.countByUsuarioAndAcertadaTrue(u)).thenReturn(5L);
        when(usuarioLogroRepository.countByUsuario(u)).thenReturn(7L);
        when(votoRepository.topPorUsuario(eq(u), any())).thenReturn(List.of(
                item("naruto", "Naruto", 30),
                item("sasuke", "Naruto", 20),
                item("ichigo", "Bleach", 10)));
        // 4 días con voto: d, d+1, d+2 (racha de 3), hueco, d+5, d+6 (racha de 2).
        LocalDate d = LocalDate.of(2026, 1, 1);
        when(votoRepository.fechasDistintasDeVoto(u)).thenReturn(List.of(
                d, d.plusDays(1), d.plusDays(2), d.plusDays(5), d.plusDays(6)));

        WrappedDto dto = service().generar(u);

        assertThat(dto.username()).isEqualTo("diego");
        assertThat(dto.votosTotales()).isEqualTo(42);
        assertThat(dto.duelosJugados()).isEqualTo(10);
        assertThat(dto.prediccionesAcertadas()).isEqualTo(5);
        assertThat(dto.badgesDesbloqueados()).isEqualTo(7);
        assertThat(dto.personajeTop()).isNotNull();
        assertThat(dto.personajeTop().slug()).isEqualTo("naruto");
        // Naruto aparece 2 veces vs Bleach 1 → fandom principal.
        assertThat(dto.fandomPrincipal()).isEqualTo("Naruto");

        // top3: 3 personajes en orden votos-desc.
        assertThat(dto.top3()).hasSize(3);
        assertThat(dto.top3()).extracting(TopPersonajeItem::slug)
                .containsExactly("naruto", "sasuke", "ichigo");

        // universoTop: anime = Naruto, slug del mejor rankeado de ese anime
        // (naruto), pct = round(100 * 2/3) = 67.
        assertThat(dto.universoTop()).isNotNull();
        assertThat(dto.universoTop().anime()).isEqualTo("Naruto");
        assertThat(dto.universoTop().slug()).isEqualTo("naruto");
        assertThat(dto.universoTop().pct()).isEqualTo(67);

        // mejorRacha: la mejor corrida es d..d+2 → 3.
        assertThat(dto.mejorRacha()).isEqualTo(3);
    }

    @Test
    void top3SeRecortaCuandoHayMenosDeTres() {
        Usuario u = mock(Usuario.class);
        when(u.getUsername()).thenReturn("dos");
        when(u.getPvpPartidos()).thenReturn(0);
        when(votoRepository.countByUsuario(u)).thenReturn(3L);
        when(prediccionRepository.countByUsuarioAndAcertadaTrue(u)).thenReturn(0L);
        when(usuarioLogroRepository.countByUsuario(u)).thenReturn(0L);
        when(votoRepository.topPorUsuario(eq(u), any())).thenReturn(List.of(
                item("luffy", "One Piece", 2),
                item("zoro", "One Piece", 1)));
        LocalDate d = LocalDate.of(2026, 3, 10);
        when(votoRepository.fechasDistintasDeVoto(u)).thenReturn(List.of(d));

        WrappedDto dto = service().generar(u);

        // top3 con solo 2 personajes.
        assertThat(dto.top3()).hasSize(2);
        assertThat(dto.top3()).extracting(TopPersonajeItem::slug)
                .containsExactly("luffy", "zoro");
        // Ambos de One Piece → 100%.
        assertThat(dto.universoTop()).isNotNull();
        assertThat(dto.universoTop().anime()).isEqualTo("One Piece");
        assertThat(dto.universoTop().slug()).isEqualTo("luffy");
        assertThat(dto.universoTop().pct()).isEqualTo(100);
        // Un único día votando → racha 1.
        assertThat(dto.mejorRacha()).isEqualTo(1);
    }

    @Test
    void sinVotosDevuelveTopYFandomNulos() {
        Usuario u = mock(Usuario.class);
        when(u.getUsername()).thenReturn("nuevo");
        when(u.getPvpPartidos()).thenReturn(0);
        when(votoRepository.countByUsuario(u)).thenReturn(0L);
        when(prediccionRepository.countByUsuarioAndAcertadaTrue(u)).thenReturn(0L);
        when(usuarioLogroRepository.countByUsuario(u)).thenReturn(0L);
        when(votoRepository.topPorUsuario(eq(u), any())).thenReturn(List.of());
        when(votoRepository.fechasDistintasDeVoto(u)).thenReturn(List.of());

        WrappedDto dto = service().generar(u);

        assertThat(dto.votosTotales()).isZero();
        assertThat(dto.personajeTop()).isNull();
        assertThat(dto.fandomPrincipal()).isNull();
        // Nuevos campos: top3 vacío (nunca null), universoTop null, racha 0.
        assertThat(dto.top3()).isEmpty();
        assertThat(dto.universoTop()).isNull();
        assertThat(dto.mejorRacha()).isZero();
    }

    // --- Helper de racha (puro, testeable directamente) ---

    @Test
    void rachaVaciaEsCero() {
        assertThat(WrappedService.mejorRachaDias(List.of())).isZero();
        assertThat(WrappedService.mejorRachaDias(null)).isZero();
    }

    @Test
    void rachaUnDiaEsUno() {
        assertThat(WrappedService.mejorRachaDias(List.of(LocalDate.of(2026, 1, 1)))).isEqualTo(1);
    }

    @Test
    void rachaLargaCorridaConHueco() {
        LocalDate d = LocalDate.of(2026, 1, 1);
        // [d, d+1, d+2, hueco, d+5, d+6] → corrida más larga 3.
        List<LocalDate> fechas = List.of(d, d.plusDays(1), d.plusDays(2), d.plusDays(5), d.plusDays(6));
        assertThat(WrappedService.mejorRachaDias(fechas)).isEqualTo(3);
    }

    @Test
    void rachaIgnoraDuplicadosDeMismoDia() {
        LocalDate d = LocalDate.of(2026, 1, 1);
        // Duplicados de mismo día no rompen ni alargan: d, d, d+1 → 2.
        List<LocalDate> fechas = List.of(d, d, d.plusDays(1));
        assertThat(WrappedService.mejorRachaDias(fechas)).isEqualTo(2);
    }
}
