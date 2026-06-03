package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.diegoalegil.animeshowdown.dto.EventoTematicoDto;
import com.diegoalegil.animeshowdown.service.EventoTematicoService;

class EventoTematicoControllerTest {

    @Test
    void listaEventosPublicosConShapeRuntime() {
        EventoTematicoService service = mock(EventoTematicoService.class);
        var dto = dto("copa-villanos");
        when(service.listarPublicos()).thenReturn(List.of(dto));
        EventoTematicoController controller = new EventoTematicoController(service);

        var response = controller.listar();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsExactly(dto);
    }

    @Test
    void detalleDevuelve404SiNoExiste() {
        EventoTematicoService service = mock(EventoTematicoService.class);
        when(service.buscarPublico("nope")).thenReturn(Optional.empty());
        EventoTematicoController controller = new EventoTematicoController(service);

        var response = controller.detalle("nope");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    private static EventoTematicoDto dto(String slug) {
        return new EventoTematicoDto(
                slug,
                "Copa Villanos",
                "Antagonistas en runtime",
                new EventoTematicoDto.Tipo("slugs", List.of("madara", "sukuna")),
                "2026-06-01T00:00:00Z",
                "2026-06-07T23:59:59Z",
                "rose",
                "*",
                new EventoTematicoDto.Cup(true, 8, "Copa Villanos"));
    }
}
