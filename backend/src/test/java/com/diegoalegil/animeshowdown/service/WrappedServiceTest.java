package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

        WrappedDto dto = service().generar(u);

        assertThat(dto.votosTotales()).isZero();
        assertThat(dto.personajeTop()).isNull();
        assertThat(dto.fandomPrincipal()).isNull();
    }
}
