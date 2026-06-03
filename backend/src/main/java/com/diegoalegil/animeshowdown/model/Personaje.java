package com.diegoalegil.animeshowdown.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;


@Entity
@Table(name = "personajes", indexes = {
        // El UNIQUE de slug ya crea índice implícito; lo declaramos explícito
        // para nombrarlo de forma estable y dejar el intent en código.
        // idx_personajes_anime acelera findByAnime (filtros por anime en
        // GET /api/personajes?anime=Naruto y queries del catálogo).
        @Index(name = "idx_personajes_slug", columnList = "slug"),
        @Index(name = "idx_personajes_anime", columnList = "anime")
})
public class Personaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String slug;

    private String nombre;
    private String anime;
    @Column(length =  500)
    private String descripcion;
    @Column(length =  500)
    private String imagenUrl;
    @Column(length = 16)
    private String imagenColorDominante;

    // ELO semilla investigado (V68). Todos nullable: NULL = sin dato → fallback
    // explícito a 1500 (la app se comporta idéntica a hoy mientras no haya seed).
    @Column(length = 16)
    private String genero;                 // 'F','M','O', NULL = sin dato
    private Integer eloSemilla;            // NULL = sin semilla → fallback 1500
    private Integer popularidadFuente;     // favourites crudos (auditar/recalcular)

    public Personaje() {
    }

    public Personaje(String nombre, String anime, String descripcion, String imagen) {
        this.nombre = nombre;
        this.anime = anime;
        this.descripcion = descripcion;
        this.imagenUrl = imagen;
    }

    public Personaje(String slug, String nombre, String anime, String descripcion, String imagen) {
        this.slug = slug;
        this.nombre = nombre;
        this.anime = anime;
        this.descripcion = descripcion;
        this.imagenUrl = imagen;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getAnime() {
        return anime;
    }

    public void setAnime(String anime) {
        this.anime = anime;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getImagenUrl() {
        return imagenUrl;
    }

    public void setImagenUrl(String imagen) {
        this.imagenUrl = imagen;
    }

    public String getImagenColorDominante() {
        return imagenColorDominante;
    }

    public void setImagenColorDominante(String imagenColorDominante) {
        this.imagenColorDominante = imagenColorDominante;
    }

    public String getGenero() {
        return genero;
    }

    public void setGenero(String genero) {
        this.genero = genero;
    }

    public Integer getEloSemilla() {
        return eloSemilla;
    }

    public void setEloSemilla(Integer eloSemilla) {
        this.eloSemilla = eloSemilla;
    }

    public Integer getPopularidadFuente() {
        return popularidadFuente;
    }

    public void setPopularidadFuente(Integer popularidadFuente) {
        this.popularidadFuente = popularidadFuente;
    }

}
