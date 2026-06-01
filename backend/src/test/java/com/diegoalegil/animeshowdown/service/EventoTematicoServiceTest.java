package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.EventoFiltroKind;
import com.diegoalegil.animeshowdown.model.EventoTematico;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.EventoTematicoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@ExtendWith(MockitoExtension.class)
class EventoTematicoServiceTest {

    @Mock private EventoTematicoRepository eventoRepository;
    @Mock private PersonajeRepository personajeRepository;

    @Test
    void dtoExponeShapeCompatibleConFrontend() {
        EventoTematicoService service = new EventoTematicoService(eventoRepository, personajeRepository);
        EventoTematico evento = evento("copa-villanos", EventoFiltroKind.SLUGS, "madara,sukuna,makima");

        var dto = service.toDto(evento);

        assertThat(dto.slug()).isEqualTo("copa-villanos");
        assertThat(dto.tipo().kind()).isEqualTo("slugs");
        assertThat(dto.tipo().valor()).isEqualTo(List.of("madara", "sukuna", "makima"));
        assertThat(dto.inicioISO()).isEqualTo("2026-06-01T00:00:00Z");
        assertThat(dto.cup().enabled()).isTrue();
        assertThat(dto.cup().tamano()).isEqualTo(8);
        assertThat(dto.cup().nombre()).isEqualTo("Copa Villanos");
    }

    @Test
    void participantesPorSlugsRespetanOrdenDelFiltro() {
        EventoTematicoService service = new EventoTematicoService(eventoRepository, personajeRepository);
        EventoTematico evento = evento("runtime", EventoFiltroKind.SLUGS, "luffy,naruto,goku");
        when(personajeRepository.findBySlugIn(List.of("luffy", "naruto", "goku")))
                .thenReturn(List.of(personaje("goku"), personaje("luffy"), personaje("naruto")));

        List<Personaje> seleccionados = service.seleccionarParticipantes(evento, 3);

        assertThat(seleccionados).extracting(Personaje::getSlug)
                .containsExactly("luffy", "naruto", "goku");
    }

    @Test
    void actualizarRechazaSlugDuplicadoAntesDeLlegarALaBaseDeDatos() {
        EventoTematicoService service = new EventoTematicoService(eventoRepository, personajeRepository);
        when(eventoRepository.findBySlug("copa-villanos"))
                .thenReturn(Optional.of(evento("copa-villanos", EventoFiltroKind.SLUGS, "madara,sukuna,makima")));
        when(eventoRepository.existsBySlug("copa-heroes")).thenReturn(true);

        assertThatThrownBy(() -> service.actualizar("copa-villanos", request("copa-heroes")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("copa-heroes");
    }

    private static EventoTematico evento(String slug, EventoFiltroKind kind, String valor) {
        EventoTematico evento = new EventoTematico();
        evento.setSlug(slug);
        evento.setTitulo("Copa Villanos");
        evento.setDescripcionCorta("Antagonistas en runtime");
        evento.setFiltroKind(kind);
        evento.setFiltroValor(valor);
        evento.setInicio(LocalDateTime.of(2026, 6, 1, 0, 0));
        evento.setFin(LocalDateTime.of(2026, 6, 7, 23, 59));
        evento.setColor("rose");
        evento.setEmoji("😈");
        evento.setCupEnabled(true);
        evento.setCupSize(8);
        evento.setCupNombre("Copa Villanos");
        return evento;
    }

    private static Personaje personaje(String slug) {
        Personaje personaje = new Personaje();
        personaje.setSlug(slug);
        personaje.setNombre(slug);
        personaje.setAnime("Test");
        return personaje;
    }

    private static com.diegoalegil.animeshowdown.dto.EventoTematicoRequest request(String slug) {
        return new com.diegoalegil.animeshowdown.dto.EventoTematicoRequest(
                slug,
                "Copa Heroes",
                "Heroes en runtime",
                new com.diegoalegil.animeshowdown.dto.EventoTematicoRequest.Tipo(
                        "slugs",
                        List.of("luffy", "naruto", "goku")),
                "2026-06-01T00:00:00Z",
                "2026-06-07T23:59:00Z",
                "amber",
                "✨",
                true,
                new com.diegoalegil.animeshowdown.dto.EventoTematicoRequest.Cup(true, 8, "Copa Heroes"));
    }
}
