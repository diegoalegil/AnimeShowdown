package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
