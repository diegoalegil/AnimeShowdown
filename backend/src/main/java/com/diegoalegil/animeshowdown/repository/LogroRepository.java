package com.diegoalegil.animeshowdown.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.Logro;

public interface LogroRepository extends JpaRepository<Logro, Long> {

    /** Lookup por codigo estable (ej. "primer_voto"). Se cachea en BadgeService. */
    Optional<Logro> findByCodigo(String codigo);
}
