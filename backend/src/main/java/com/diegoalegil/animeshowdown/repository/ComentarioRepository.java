package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Comentario;
import com.diegoalegil.animeshowdown.model.ComentarioEstado;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface ComentarioRepository extends JpaRepository<Comentario, Long> {

    @Override
    @EntityGraph(attributePaths = "autor")
    Optional<Comentario> findById(Long id);

    @EntityGraph(attributePaths = "autor")
    Page<Comentario> findByPersonajeSlugAndEstadoOrderByCreadoEnDesc(
            String personajeSlug,
            ComentarioEstado estado,
            Pageable pageable);

    @EntityGraph(attributePaths = "autor")
    Page<Comentario> findByEstadoOrderByCreadoEnDesc(ComentarioEstado estado, Pageable pageable);

    @EntityGraph(attributePaths = "autor")
    Page<Comentario> findAllByOrderByCreadoEnDesc(Pageable pageable);

    long countByAutorAndCreadoEnAfter(Usuario autor, LocalDateTime fecha);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Comentario c
            SET c.reportes = COALESCE(c.reportes, 0) + 1,
                c.estado = :nuevoEstado
            WHERE c.id = :id
              AND c.estado <> :estadoEliminado
            """)
    int incrementarReporte(
            @Param("id") Long id,
            @Param("nuevoEstado") ComentarioEstado nuevoEstado,
            @Param("estadoEliminado") ComentarioEstado estadoEliminado);
}
