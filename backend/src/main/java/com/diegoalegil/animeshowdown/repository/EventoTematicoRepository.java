package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.EventoTematico;

public interface EventoTematicoRepository extends JpaRepository<EventoTematico, Long> {

    Optional<EventoTematico> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<EventoTematico> findByActivoTrueOrderByInicioAsc();

    @Query("""
            SELECT e
            FROM EventoTematico e
            WHERE e.activo = true
              AND e.cupEnabled = true
              AND e.inicio <= :now
              AND e.fin >= :now
            ORDER BY e.inicio DESC, e.id ASC
            """)
    List<EventoTematico> findCopasActivas(@Param("now") LocalDateTime now);
}
