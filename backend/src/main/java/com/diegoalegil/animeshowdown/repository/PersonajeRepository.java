package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.diegoalegil.animeshowdown.model.Personaje;

public interface PersonajeRepository extends JpaRepository<Personaje, Long> {

    List<Personaje> findByAnime(String anime);

    /** Lookup por slug URL-safe — usado por OG image y endpoints públicos. */
    Optional<Personaje> findBySlug(String slug);

    /** Batch lookup por lista de slugs. Sprint 2026-05-18 actividad reciente. */
    List<Personaje> findBySlugIn(java.util.Collection<String> slugs);

    boolean existsByNombre(String nombre);

    /**
     * Proyección column-only para healthcheck (P2 audit 2026-05-17): cargar
     * la entidad completa solo para comparar slugs era desperdicio. Esta
     * query devuelve solo {@code slug}, suficiente para detectar drift
     * BBDD↔seed por composición (no solo por count).
     */
    @Query("SELECT p.slug FROM Personaje p")
    List<String> findAllSlugs();
}
