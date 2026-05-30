package com.diegoalegil.animeshowdown.model;

/**
 * Intención de voto (feature #15): el "por qué" opcional de un voto en un
 * duelo. Cada categoría alimenta su propio ranking sin tocar el global.
 *
 * <p>Lista CERRADA (decisión del owner): Poder · Diseño · Carisma ·
 * Mejor escrito · Mejor villano · Favorito personal. Ampliar la lista es una
 * línea aquí — NO una migración nueva: la validación de la categoría vive en
 * esta capa Java, no en un CHECK en DDL inmutable.
 *
 * <p>El {@code id} es el valor de wire ESTABLE: es lo que se persiste en
 * {@code votos.categoria}, lo que viaja en la API y en la URL
 * ({@code /ranking?intencion=mejor-villano}) y lo que comparte el catálogo del
 * frontend ({@code voto-intenciones.js}). Mantenemos los tres en lockstep por
 * un test de drift. Guardamos el id (kebab) y NO {@code name()} para evitar una
 * capa de traducción en las queries y que DB ↔ API ↔ URL ↔ UI sean idénticos.
 * Las etiquetas legibles ("Mejor villano") viven SOLO en el frontend, así
 * relabelar/traducir nunca toca la BBDD ni la API.
 */
public enum CategoriaVoto {

    PODER("poder"),
    DISENO("diseno"),
    CARISMA("carisma"),
    MEJOR_ESCRITO("mejor-escrito"),
    MEJOR_VILLANO("mejor-villano"),
    FAVORITO("favorito");

    private final String id;

    CategoriaVoto(String id) {
        this.id = id;
    }

    /** Id de wire estable (kebab) persistido en {@code votos.categoria}. */
    public String getId() {
        return id;
    }

    /**
     * Resuelve una categoría por su id de wire. TOLERANTE por diseño: null,
     * blank o desconocido devuelven {@code null} (= "voto sin intención").
     * Nunca lanza — una categoría inválida degrada el voto a sin-categoría,
     * jamás lo rechaza ni pierde. Normaliza espacios y mayúsculas.
     */
    public static CategoriaVoto fromId(String raw) {
        if (raw == null) {
            return null;
        }
        String norm = raw.trim().toLowerCase();
        if (norm.isEmpty()) {
            return null;
        }
        for (CategoriaVoto c : values()) {
            if (c.id.equals(norm)) {
                return c;
            }
        }
        return null;
    }
}
