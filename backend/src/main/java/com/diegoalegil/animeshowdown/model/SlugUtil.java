package com.diegoalegil.animeshowdown.model;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Generador de slugs URL-safe a partir de texto libre. Pensado para nombres
 * de torneos (`/torneos/best-girls-2026`) — equivalente al slugifier que
 * el frontend usa en `scripts/sync-personajes.mjs`.
 *
 * Reglas:
 *   - Normaliza Unicode NFD, elimina diacríticos (ñ → n, é → e).
 *   - Pasa a lowercase.
 *   - Convierte cualquier secuencia no-[a-z0-9] en un único guión.
 *   - Recorta guiones de inicio/fin.
 *   - Trunca a 80 chars (límite de la columna `torneos.slug`).
 *
 * No garantiza unicidad — eso lo hace TorneoService.crear() consultando
 * findBySlug y añadiendo sufijo numérico si colisiona.
 */
public final class SlugUtil {

    private static final Pattern DIACRITICOS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
    private static final Pattern NO_ALFANUM = Pattern.compile("[^a-z0-9]+");
    private static final Pattern GUIONES_BORDE = Pattern.compile("^-+|-+$");
    private static final int MAX_LONGITUD = 80;

    private SlugUtil() {
        // utility class
    }

    public static String slugify(String texto) {
        if (texto == null || texto.isBlank()) {
            return "sin-titulo";
        }
        String normalizado = Normalizer.normalize(texto, Normalizer.Form.NFD);
        String sinDiacriticos = DIACRITICOS.matcher(normalizado).replaceAll("");
        String lower = sinDiacriticos.toLowerCase();
        String conGuiones = NO_ALFANUM.matcher(lower).replaceAll("-");
        String trimmed = GUIONES_BORDE.matcher(conGuiones).replaceAll("");
        if (trimmed.isEmpty()) {
            return "sin-titulo";
        }
        return trimmed.length() > MAX_LONGITUD ? trimmed.substring(0, MAX_LONGITUD) : trimmed;
    }
}
