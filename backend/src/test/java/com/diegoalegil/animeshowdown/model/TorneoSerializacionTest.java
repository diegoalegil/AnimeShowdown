package com.diegoalegil.animeshowdown.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Regresión de privacidad: la entidad {@link Torneo} nunca debe serializar la
 * relación {@code creadoPor} (un {@link Usuario} con email) ni
 * {@code ganadorPersonaje}, aunque algún endpoint devuelva la entidad cruda.
 * Las respuestas de torneo usan DTOs; este test blinda el @JsonIgnore que actúa
 * como defensa en profundidad para que la fuga no pueda reaparecer en silencio.
 */
class TorneoSerializacionTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void serializarTorneoNoExponeElEmailNiElUsuarioCreador() throws Exception {
        Usuario creador = new Usuario("diego", "hash-irrelevante", "secreto@privado.com");

        Torneo torneo = new Torneo();
        torneo.setNombre("Best Girls 2026");
        torneo.setEstado(EstadoTorneo.SCHEDULED);
        torneo.setCreadoPor(creador);

        String json = mapper.writeValueAsString(torneo);

        // El email y la relación del creador NO viajan en la respuesta.
        assertThat(json)
                .doesNotContain("secreto@privado.com")
                .doesNotContain("creadoPor")
                .doesNotContain("ganadorPersonaje");
        // Los campos legítimos del torneo sí se serializan.
        assertThat(json)
                .contains("Best Girls 2026")
                .contains("SCHEDULED");
    }
}
