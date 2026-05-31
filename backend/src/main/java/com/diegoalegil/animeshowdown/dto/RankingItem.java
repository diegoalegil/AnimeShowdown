package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Personaje;

/**
 * Entrada del ranking público.
 *
 * <p>Separamos dos métricas
 * para evitar truncar la ponderación de votos:
 *
 * <ul>
 *   <li>{@code votos}: score visible. Voto normal suma 1; empate neutral
 *       suma 0.5 a cada personaje.</li>
 *   <li>{@code pesoVotos}: ponderado real (SUM(v.peso), 0.30 anónimos,
 *       1.00 registrados). Lo usa el backend para ORDER BY y lo
 *       expone en el JSON para que el frontend pueda reordenar la caché
 *       live (WebSocket) sin desalinearse del orden REST. Tipo Double
 *       porque BigDecimal en JSON viaja como string y rompe el contrato
 *       con consumers JS.</li>
 * </ul>
 *
 * <p>Antes el campo {@code votos} llevaba {@code cast(SUM(peso) as long)},
 * lo que truncaba "0.9" a "0" — orden interno correcto pero UI mentirosa.
 */
public class RankingItem {

    private Personaje personaje;
    private Double votos;
    private Double pesoVotos;

    public RankingItem(Personaje personaje, Long votos) {
        this.personaje = personaje;
        this.votos = votos == null ? 0.0 : votos.doubleValue();
        this.pesoVotos = votos == null ? 0.0 : votos.doubleValue();
    }

    public RankingItem(Long personajeId, String slug, String nombre, String anime,
            String imagenUrl, Long votos) {
        this(personajeId, slug, nombre, anime, imagenUrl, votos,
                votos == null ? 0.0 : votos.doubleValue());
    }

    public RankingItem(Long personajeId, String slug, String nombre, String anime,
            String imagenUrl, Long votos, Double pesoVotos) {
        this(personajeId, slug, nombre, anime, imagenUrl,
                votos == null ? 0.0 : votos.doubleValue(), pesoVotos);
    }

    public RankingItem(Long personajeId, String slug, String nombre, String anime,
            String imagenUrl, Double votos, Double pesoVotos) {
        Personaje p = new Personaje();
        p.setId(personajeId);
        p.setSlug(slug);
        p.setNombre(nombre);
        p.setAnime(anime);
        p.setImagenUrl(imagenUrl);
        this.personaje = p;
        this.votos = votos == null ? 0.0 : votos;
        this.pesoVotos = pesoVotos == null ? 0.0 : pesoVotos;
    }

    public Personaje getPersonaje() {
        return personaje;
    }

    public Double getVotos() {
        return votos;
    }

    public Double getPesoVotos() {
        return pesoVotos;
    }
}
