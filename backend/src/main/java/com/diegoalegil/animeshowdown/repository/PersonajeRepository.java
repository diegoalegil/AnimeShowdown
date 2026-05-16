package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.Personaje;

public interface PersonajeRepository extends JpaRepository<Personaje, Long> {

    List<Personaje> findByAnime(String anime);

    /** Lookup por slug URL-safe — usado por OG image y endpoints públicos. */
    Optional<Personaje> findBySlug(String slug);

    boolean existsByNombre(String nombre);
}
