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

    /**
     * Registra un reporte único por (comentario, usuario). ON CONFLICT DO NOTHING
     * → devuelve 0 si el usuario ya había reportado ese comentario (sin lanzar, para
     * no abortar la tx en Postgres). Así el contador refleja reportantes distintos.
     */
    @Modifying
    @Query(value = """
            INSERT INTO reporte_comentario (comentario_id, usuario_id)
            VALUES (:comentarioId, :usuarioId)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertarReporteSiFalta(@Param("comentarioId") Long comentarioId,
            @Param("usuarioId") Long usuarioId);

    /**
     * Incrementa el contador de reportes y pasa a {@code pendiente} SOLO si el nuevo
     * contador alcanza el umbral. Antes el estado se cambiaba con un único reporte,
     * así que cualquier usuario ocultaba cualquier comentario al instante.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Comentario c
            SET c.reportes = COALESCE(c.reportes, 0) + 1,
                c.estado = CASE WHEN COALESCE(c.reportes, 0) + 1 >= :umbral
                                THEN :pendiente ELSE c.estado END
            WHERE c.id = :id
              AND c.estado <> :estadoEliminado
            """)
    int incrementarReporteConUmbral(
            @Param("id") Long id,
            @Param("umbral") int umbral,
            @Param("pendiente") ComentarioEstado pendiente,
            @Param("estadoEliminado") ComentarioEstado estadoEliminado);
}
