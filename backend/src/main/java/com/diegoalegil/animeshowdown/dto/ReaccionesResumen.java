package com.diegoalegil.animeshowdown.dto;

import java.util.EnumMap;
import java.util.Map;

import com.diegoalegil.animeshowdown.model.ReaccionTipo;

/**
 * Resumen de reactions para un target (Plan v2 §4.3).
 *
 * <ul>
 *   <li>{@code counts} — siempre incluye las 4 keys del enum, con valor 0
 *       para las que no tienen ninguna. Así el frontend pinta los 4
 *       botones con su contador sin necesidad de hacer fallbacks.</li>
 *   <li>{@code miReaccion} — la reaction del usuario actual, o null si no
 *       ha reaccionado o no está logueado. Se pinta el botón
 *       correspondiente con estado seleccionado.</li>
 *   <li>{@code total} — suma rápida que el cliente puede pintar como
 *       "245 reacciones" sin tener que sumar las 4.</li>
 * </ul>
 */
public record ReaccionesResumen(
        Map<ReaccionTipo, Long> counts,
        ReaccionTipo miReaccion,
        long total) {

    public static ReaccionesResumen vacia() {
        Map<ReaccionTipo, Long> ceros = new EnumMap<>(ReaccionTipo.class);
        for (ReaccionTipo t : ReaccionTipo.values()) ceros.put(t, 0L);
        return new ReaccionesResumen(ceros, null, 0L);
    }
}
