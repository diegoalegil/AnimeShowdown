package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.MadrugadorDia;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface MadrugadorDiaRepository extends JpaRepository<MadrugadorDia, Long> {

    boolean existsByPersonajeSlugAndFecha(String personajeSlug, LocalDate fecha);

    Optional<MadrugadorDia> findByPersonajeSlugAndFecha(String personajeSlug, LocalDate fecha);

    long countByPersonajeSlugAndFecha(String personajeSlug, LocalDate fecha);

    long countByPrimerUserAndPersonajeSlugAndFecha(Usuario primerUser, String personajeSlug, LocalDate fecha);
}
