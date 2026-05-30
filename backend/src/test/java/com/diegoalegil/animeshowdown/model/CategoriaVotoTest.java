package com.diegoalegil.animeshowdown.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import org.junit.jupiter.api.Test;

/**
 * El parseo de {@link CategoriaVoto#fromId} debe ser TOLERANTE: una categoría
 * inválida/blank degrada el voto a "sin intención" (null), nunca lanza ni lo
 * rechaza — la intención de voto es opcional (feature #15).
 */
class CategoriaVotoTest {

    @Test
    void fromIdResuelveLosSeisIdsDeWire() {
        assertSame(CategoriaVoto.PODER, CategoriaVoto.fromId("poder"));
        assertSame(CategoriaVoto.DISENO, CategoriaVoto.fromId("diseno"));
        assertSame(CategoriaVoto.CARISMA, CategoriaVoto.fromId("carisma"));
        assertSame(CategoriaVoto.MEJOR_ESCRITO, CategoriaVoto.fromId("mejor-escrito"));
        assertSame(CategoriaVoto.MEJOR_VILLANO, CategoriaVoto.fromId("mejor-villano"));
        assertSame(CategoriaVoto.FAVORITO, CategoriaVoto.fromId("favorito"));
    }

    @Test
    void fromIdNormalizaMayusculasYEspacios() {
        assertSame(CategoriaVoto.PODER, CategoriaVoto.fromId("  PODER "));
        assertSame(CategoriaVoto.MEJOR_VILLANO, CategoriaVoto.fromId("Mejor-Villano"));
    }

    @Test
    void fromIdToleranteDevuelveNullEnEntradasInvalidas() {
        assertNull(CategoriaVoto.fromId(null), "null → sin intención");
        assertNull(CategoriaVoto.fromId(""), "vacío → sin intención");
        assertNull(CategoriaVoto.fromId("   "), "solo espacios → sin intención");
        assertNull(CategoriaVoto.fromId("desconocido"), "id no del set → sin intención");
        // El name() de los enum multi-palabra usa guión BAJO; el id de wire usa
        // guión NORMAL ('mejor-villano'). Mandar el name() por error → sin
        // intención, no un match accidental. (Para los de una palabra, name
        // lowercased == id por diseño, y eso sí es un match válido — fromId es
        // case-insensitive.)
        assertNull(CategoriaVoto.fromId("mejor_villano"),
                "name() con guión bajo no es id de wire");
    }

    @Test
    void getIdEsElValorDeWirePersistidoYRoundTrips() {
        for (CategoriaVoto c : CategoriaVoto.values()) {
            assertSame(c, CategoriaVoto.fromId(c.getId()),
                    "getId() debe round-trippear por fromId para " + c);
        }
        assertEquals("mejor-villano", CategoriaVoto.MEJOR_VILLANO.getId());
    }
}
