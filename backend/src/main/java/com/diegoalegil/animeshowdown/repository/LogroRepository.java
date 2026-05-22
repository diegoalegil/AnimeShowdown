package com.diegoalegil.animeshowdown.repository;

import java.util.Optional;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.diegoalegil.animeshowdown.model.Logro;

public interface LogroRepository extends JpaRepository<Logro, Long> {

    /** Lookup por codigo estable (ej. "primer_voto"). Se cachea en BadgeService. */
    Optional<Logro> findByCodigo(String codigo);

    @Query("select l from Logro l where l.codigo not like 'madrugador_%' order by l.id")
    List<Logro> findCatalogoEstatico();
}
