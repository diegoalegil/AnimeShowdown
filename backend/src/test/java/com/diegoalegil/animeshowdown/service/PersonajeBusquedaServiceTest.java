package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.dto.PersonajeCatalogoDto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@ExtendWith(MockitoExtension.class)
class PersonajeBusquedaServiceTest {

    @Mock
    private PersonajeRepository personajeRepository;

    @Test
    void buscarUsaIndiceLigeroEnMemoriaSinLikePorPulsacion() {
        PersonajeBusquedaService service = new PersonajeBusquedaService(
                personajeRepository,
                Clock.fixed(Instant.parse("2026-06-01T10:00:00Z"), ZoneOffset.UTC));
        when(personajeRepository.findAllCatalogoOrderBySlug())
                .thenReturn(List.of(
                        personaje(1L, "luffy", "Monkey D. Luffy", "One Piece", "Capitán de los Mugiwara"),
                        personaje(2L, "naruto", "Naruto Uzumaki", "Naruto", "Hokage de Konoha"),
                        personaje(3L, "sakura", "Sakura Kinomoto", "Cardcaptor Sakura", "Magia y cartas")));

        assertThat(service.buscar("luf", 5))
                .extracting("slug")
                .containsExactly("luffy");
        assertThat(service.buscar("naruto", 5))
                .extracting("slug")
                .containsExactly("naruto");

        verify(personajeRepository).findAllCatalogoOrderBySlug();
        verify(personajeRepository, never()).buscarTexto(anyString());
    }

    @Test
    void invalidarIndiceFuerzaReconstruccionEnLaSiguienteBusqueda() {
        PersonajeBusquedaService service = new PersonajeBusquedaService(
                personajeRepository,
                Clock.fixed(Instant.parse("2026-06-01T10:00:00Z"), ZoneOffset.UTC));
        when(personajeRepository.findAllCatalogoOrderBySlug())
                .thenReturn(List.of(personaje(1L, "luffy", "Monkey D. Luffy", "One Piece", "Capitán")))
                .thenReturn(List.of(personaje(2L, "naruto", "Naruto Uzumaki", "Naruto", "Hokage")));

        assertThat(service.buscar("luf", 5))
                .extracting("slug")
                .containsExactly("luffy");

        service.invalidateIndex();

        assertThat(service.buscar("naruto", 5))
                .extracting("slug")
                .containsExactly("naruto");
        verify(personajeRepository, times(2)).findAllCatalogoOrderBySlug();
    }

    private static PersonajeCatalogoDto personaje(Long id, String slug, String nombre, String anime, String descripcion) {
        return new PersonajeCatalogoDto(
                id,
                slug,
                nombre,
                anime,
                descripcion,
                "/img/" + slug + ".webp",
                null);
    }
}
