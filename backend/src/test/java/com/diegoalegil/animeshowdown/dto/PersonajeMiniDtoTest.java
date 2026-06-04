package com.diegoalegil.animeshowdown.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.model.Personaje;

class PersonajeMiniDtoTest {

    @Test
    void fromExponeElColorDominante() {
        // El color dominante ya estaba en BD; el frontend (VoteCard, brackets)
        // lo usa de fondo para que el recorte transparente no quede sobre un
        // cuadro gris. Antes PersonajeMiniDto no lo exponía → siempre gris.
        Personaje p = new Personaje();
        p.setSlug("gojo-satoru");
        p.setNombre("Gojo Satoru");
        p.setAnime("Jujutsu Kaisen");
        p.setImagenUrl("/img/gojo.webp");
        p.setImagenColorDominante("rgb(120 80 200)");

        PersonajeMiniDto dto = PersonajeMiniDto.from(p);

        assertEquals("gojo-satoru", dto.getSlug());
        assertEquals("rgb(120 80 200)", dto.getImagenColorDominante());
    }

    @Test
    void fromNuloDevuelveNull() {
        assertNull(PersonajeMiniDto.from(null));
    }
}
