package com.diegoalegil.animeshowdown.model;

import java.util.Map;

/**
 * Aliases historicos de slugs de personajes.
 *
 * <p>El catalogo actual usa slugs cortos para varios personajes, pero informes
 * SEO/UX detectaron enlaces antiguos o generados por nombre completo. Mantener
 * esta capa evita 404 visibles sin cambiar datos ni migraciones.
 */
public final class PersonajeSlugAliases {

    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("L", "l"),
            Map.entry("all_might", "allmight"),
            Map.entry("monkey_d_luffy", "luffy"),
            Map.entry("roronoa_zoro", "zoro"),
            Map.entry("jiraiya", "jiraya"),
            Map.entry("hinata_hyuga", "hinata"),
            Map.entry("katsuki_bakugou", "bakugo"),
            Map.entry("yuji_itadori", "itadori"),
            Map.entry("shinobu_kocho", "shinobu"),
            Map.entry("boa_hancock_alt", "boa_hancock"));

    private PersonajeSlugAliases() {
    }

    public static String canonical(String slug) {
        if (slug == null) return null;
        return ALIASES.getOrDefault(slug, slug);
    }
}
