package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.Personaje;

/**
 * Entrada del ranking público.
 *
 * <p>Nota técnica AS-002 + B2.1b (2026-05-22): separamos dos métricas
 * para evitar truncar la ponderación de votos:
 *
 * <ul>
 *   <li>{@code votos}: cuenta física (COUNT(v)). Es el número que la UI
 *       muestra al usuario — "cuántas personas votaron". No miente:
 *       3 anónimos = 3 votos visibles, no 0 ni 0.9.</li>
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
    private Long votos;
    private Double pesoVotos;

    public RankingItem(Personaje personaje, Long votos) {
        this.personaje = personaje;
        this.votos = votos;
        this.pesoVotos = votos == null ? 0.0 : votos.doubleValue();
    }

    public RankingItem(Long personajeId, String slug, String nombre, String anime,
            String descripcion, String imagenUrl, Long votos) {
        this(personajeId, slug, nombre, anime, descripcion, imagenUrl, votos,
                votos == null ? 0.0 : votos.doubleValue());
    }

    public RankingItem(Long personajeId, String slug, String nombre, String anime,
            String descripcion, String imagenUrl, Long votos, Double pesoVotos) {
        Personaje p = new Personaje();
        p.setId(personajeId);
        p.setSlug(slug);
        p.setNombre(nombre);
        p.setAnime(anime);
        p.setDescripcion(descripcion);
        p.setImagenUrl(imagenUrl);
        this.personaje = p;
        this.votos = votos;
        this.pesoVotos = pesoVotos == null ? 0.0 : pesoVotos;
    }

    public Personaje getPersonaje() {
        return personaje;
    }

    public Long getVotos() {
        return votos;
    }

    public Double getPesoVotos() {
        return pesoVotos;
    }
}
