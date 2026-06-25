package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.dto.PersonajeActualizarRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeCrearRequest;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.FantasyEquipoItemRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

import jakarta.persistence.EntityNotFoundException;

/**
 * Bloquea el comportamiento de la escritura admin de personajes (extraída del
 * controller): build/save, borrado 404 vs 204, actualización parcial e
 * invalidación del índice de búsqueda en cada escritura.
 */
class PersonajeAdminServiceTest {

    private PersonajeRepository personajeRepository;
    private PersonajeBusquedaService personajeBusquedaService;
    private FantasyEquipoItemRepository fantasyEquipoItemRepository;
    private PersonajeAdminService service;

    @BeforeEach
    void setUp() {
        personajeRepository = mock(PersonajeRepository.class);
        personajeBusquedaService = mock(PersonajeBusquedaService.class);
        fantasyEquipoItemRepository = mock(FantasyEquipoItemRepository.class);
        service = new PersonajeAdminService(
                personajeRepository, personajeBusquedaService, fantasyEquipoItemRepository);
        when(personajeRepository.save(any(Personaje.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static PersonajeCrearRequest crearReq(String slug, String nombre, String anime) {
        return new PersonajeCrearRequest(slug, nombre, anime, "desc", "http://img/x.jpg");
    }

    @Test
    void crearConstruyeGuardaEInvalidaElIndice() {
        Personaje creado = service.crear(crearReq("luffy", "Luffy", "One Piece"));

        assertThat(creado.getSlug()).isEqualTo("luffy");
        assertThat(creado.getNombre()).isEqualTo("Luffy");
        assertThat(creado.getAnime()).isEqualTo("One Piece");
        verify(personajeRepository).save(any(Personaje.class));
        verify(personajeBusquedaService).invalidateIndex();
    }

    @Test
    void eliminarExistenteBorraEInvalida() {
        when(personajeRepository.existsById(7L)).thenReturn(true);

        assertThat(service.eliminar(7L)).isTrue();
        verify(personajeRepository).deleteById(7L);
        verify(personajeBusquedaService).invalidateIndex();
    }

    @Test
    void eliminarInexistenteDevuelveFalseSinBorrarNiInvalidar() {
        when(personajeRepository.existsById(7L)).thenReturn(false);

        assertThat(service.eliminar(7L)).isFalse();
        verify(personajeRepository, never()).deleteById(anyLong());
        verify(personajeBusquedaService, never()).invalidateIndex();
    }

    @Test
    void eliminarPersonajeFichadoEnFantasyRechazaCon409SinBorrar() {
        // La FK fantasy_equipo_item.personaje_id es ON DELETE CASCADE (V52): borrar
        // el personaje encogería los equipos en silencio. Se rechaza con 409.
        when(personajeRepository.existsById(7L)).thenReturn(true);
        when(fantasyEquipoItemRepository.existsByPersonajeId(7L)).thenReturn(true);

        assertThatThrownBy(() -> service.eliminar(7L))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .satisfies(e -> assertThat(
                        ((org.springframework.web.server.ResponseStatusException) e).getStatusCode().value())
                        .isEqualTo(409));
        verify(personajeRepository, never()).deleteById(anyLong());
        verify(personajeBusquedaService, never()).invalidateIndex();
    }

    @Test
    void actualizarSoloCambiaLosCamposNoNulos() {
        Personaje existente = new Personaje("luffy", "Luffy", "One Piece", "desc", "http://img/old.jpg");
        when(personajeRepository.findById(3L)).thenReturn(Optional.of(existente));

        // solo nombre; el resto queda igual (null preserva el valor previo)
        PersonajeActualizarRequest datos = new PersonajeActualizarRequest(null, "Monkey D. Luffy", null, null, null);

        Personaje actualizado = service.actualizar(3L, datos);

        assertThat(actualizado.getNombre()).isEqualTo("Monkey D. Luffy");
        assertThat(actualizado.getSlug()).isEqualTo("luffy");
        assertThat(actualizado.getAnime()).isEqualTo("One Piece");
        assertThat(actualizado.getImagenUrl()).isEqualTo("http://img/old.jpg");
        verify(personajeBusquedaService).invalidateIndex();
    }

    @Test
    void actualizarInexistenteLanzaEntityNotFound() {
        when(personajeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.actualizar(99L, new PersonajeActualizarRequest(null, null, null, null, null)))
                .isInstanceOf(EntityNotFoundException.class);
        verify(personajeBusquedaService, never()).invalidateIndex();
    }

    @Test
    void crearBatchGuardaTodosEInvalidaUnaVez() {
        List<Personaje> guardados = service.crearBatch(List.of(
                crearReq("luffy", "Luffy", "One Piece"),
                crearReq("naruto", "Naruto", "Naruto")));

        assertThat(guardados).extracting(Personaje::getSlug).containsExactly("luffy", "naruto");
        verify(personajeRepository, times(2)).save(any(Personaje.class));
        verify(personajeBusquedaService, times(1)).invalidateIndex();
    }
}
