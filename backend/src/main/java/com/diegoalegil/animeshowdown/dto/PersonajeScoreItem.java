package com.diegoalegil.animeshowdown.dto;

/**
 * Proyeccion compacta para superficies competitivas. Parte de la ELO semilla
 * canonica y suma una senal comunitaria logaritmica para evitar que el volumen
 * bruto de votos borre la fuerza base del personaje.
 */
public record PersonajeScoreItem(
        Long id,
        String slug,
        String nombre,
        String anime,
        String imagenUrl,
        String imagenColorDominante,
        Integer eloSemilla,
        Double votosTotales,
        Double votosRecientes24h) {

    private static final int ELO_FLOOR = 1500;
    private static final int ELO_CEILING = 2400;
    private static final double COMMUNITY_SIGNAL_FACTOR = 35.0;

    public int eloEstimado() {
        return calcularEloEstimado(eloSemilla, votosTotales);
    }

    public static int calcularEloEstimado(Integer eloSemilla, Double votosTotales) {
        int base = eloSemilla == null ? ELO_FLOOR : Math.max(ELO_FLOOR, eloSemilla);
        int senalComunitaria = (int) Math.round(
                Math.log1p(scoreSane(votosTotales)) * COMMUNITY_SIGNAL_FACTOR);
        return Math.min(ELO_CEILING, base + senalComunitaria);
    }

    public double recientes24h() {
        return scoreSane(votosRecientes24h);
    }

    public PersonajeMiniDto toMiniDto() {
        PersonajeMiniDto dto = new PersonajeMiniDto();
        dto.setId(id);
        dto.setSlug(slug);
        dto.setNombre(nombre);
        dto.setAnime(anime);
        dto.setImagenUrl(imagenUrl);
        // Color dominante del arte: sin él, la carta del ELO duel (HigherOrLower)
        // caía al gris var(--color-surface) en PersonajeImg salvo que el catálogo
        // global estuviese hidratado. Server-authoritative = robusto aunque el
        // catálogo deje de cebarse globalmente.
        dto.setImagenColorDominante(imagenColorDominante);
        return dto;
    }

    private static double scoreSane(Double value) {
        return value == null ? 0.0 : Math.max(0.0, value);
    }
}
