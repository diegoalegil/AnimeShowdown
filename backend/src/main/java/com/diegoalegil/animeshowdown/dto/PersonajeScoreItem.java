package com.diegoalegil.animeshowdown.dto;

/**
 * Proyeccion compacta para el sugeridor de duelos. El backend actual no
 * persiste ELO por personaje, asi que usamos el volumen de votos como senal
 * de fuerza y lo transformamos en un ELO estimado estable.
 */
public record PersonajeScoreItem(
        Long id,
        String slug,
        String nombre,
        String anime,
        String imagenUrl,
        String imagenColorDominante,
        Double votosTotales,
        Double votosRecientes24h) {

    public int eloEstimado() {
        double elo = 1500 + scoreSane(votosTotales);
        return elo > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) Math.floor(elo);
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
