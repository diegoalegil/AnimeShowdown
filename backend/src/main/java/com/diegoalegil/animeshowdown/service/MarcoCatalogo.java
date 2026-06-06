package com.diegoalegil.animeshowdown.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.diegoalegil.animeshowdown.model.Marco;

/**
 * Catálogo curado de marcos de avatar (cosmético coin-sink). Finitos, definidos
 * en código (sin panel admin): cambiar la oferta = editar este archivo.
 *
 * <p>Los precios son el sink de moneda blanda (escalan con la rareza). La
 * rareza/estilo reusan la paleta existente del frontend (bronce/plata/oro +
 * aura cian/carmesí/prismática) — el backend solo expone la clave {@code estilo}
 * y el frontend la traduce a clases Tailwind.
 */
public final class MarcoCatalogo {

    private MarcoCatalogo() {
    }

    private static final List<Marco> MARCOS = List.of(
            new Marco("bronce", "Marco Bronce",
                    "Un anillo sobrio de bronce para estrenar tu colección.",
                    150L, "COMUN", "ring-bronce"),
            new Marco("plata", "Marco Plata",
                    "Brillo plateado discreto alrededor de tu avatar.",
                    300L, "COMUN", "ring-plata"),
            new Marco("oro", "Marco Oro",
                    "El clásico anillo dorado de la casa.",
                    600L, "RARO", "ring-oro"),
            new Marco("cian", "Aura Cian",
                    "El halo cian pulsante de los sobres especiales.",
                    1000L, "EPICO", "aura-cian"),
            new Marco("carmesi", "Llama Carmesí",
                    "Aura carmesí intensa para los más competitivos.",
                    1500L, "EPICO", "aura-carmesi"),
            new Marco("prismatico", "Halo Prismático",
                    "El marco legendario: degradado animado multicolor.",
                    3000L, "LEGENDARIO", "aura-prismatico"));

    private static final Map<String, Marco> POR_ID = indexar();

    private static Map<String, Marco> indexar() {
        Map<String, Marco> m = new LinkedHashMap<>();
        for (Marco marco : MARCOS) {
            m.put(marco.id(), marco);
        }
        return m;
    }

    public static List<Marco> todos() {
        return MARCOS;
    }

    public static Optional<Marco> porId(String id) {
        return Optional.ofNullable(id == null ? null : POR_ID.get(id));
    }

    public static boolean existe(String id) {
        return id != null && POR_ID.containsKey(id);
    }
}
