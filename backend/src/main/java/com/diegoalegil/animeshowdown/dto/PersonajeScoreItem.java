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
        Long votosTotales,
        Long votosRecientes24h) {

    public int eloEstimado() {
        return 1500 + Math.toIntExact(votosTotales == null ? 0L : votosTotales);
    }

    public long recientes24h() {
        return votosRecientes24h == null ? 0L : votosRecientes24h;
    }

    public PersonajeMiniDto toMiniDto() {
        PersonajeMiniDto dto = new PersonajeMiniDto();
        dto.setId(id);
        dto.setSlug(slug);
        dto.setNombre(nombre);
        dto.setAnime(anime);
        dto.setImagenUrl(imagenUrl);
        return dto;
    }
}
