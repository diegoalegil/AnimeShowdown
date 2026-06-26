package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Seguidor;
import com.diegoalegil.animeshowdown.model.Seguidor.SeguidorId;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface SeguidorRepository extends JpaRepository<Seguidor, SeguidorId> {

    /** "¿Sigue A a B?" — check rápido sin cargar la fila. */
    boolean existsByIdSeguidorIdAndIdSeguidoId(Long seguidorId, Long seguidoId);

    /** A quién sigue el usuario dado, ordenado por fecha desc. */
    @Query("""
            SELECT s.seguido
            FROM Seguidor s
            WHERE s.seguidor = :usuario
            ORDER BY s.fechaInicio DESC
            """)
    List<Usuario> seguidosDe(@Param("usuario") Usuario usuario);

    /** Quién sigue al usuario dado, ordenado por fecha desc. */
    @Query("""
            SELECT s.seguidor
            FROM Seguidor s
            WHERE s.seguido = :usuario
            ORDER BY s.fechaInicio DESC
            """)
    List<Usuario> seguidoresDe(@Param("usuario") Usuario usuario);

    /** Counts para mostrar en perfil (X seguidos, Y seguidores). */
    long countByIdSeguidorId(Long seguidorId);

    long countByIdSeguidoId(Long seguidoId);

    @Modifying
    @Query("DELETE FROM Seguidor s WHERE s.id.seguidorId = :seguidorId AND s.id.seguidoId = :seguidoId")
    int deleteRelacion(@Param("seguidorId") Long seguidorId, @Param("seguidoId") Long seguidoId);

    /**
     * Inserta la relación de forma atómica idempotente (ON CONFLICT DO NOTHING):
     * devuelve 1 si era nueva, 0 si ya existía (o si dos peticiones concurrentes
     * carreran). No lanza (un INSERT plano + catch reventaría la tx en Postgres),
     * así que NO necesita el lock global de SocialOperationLock para serializar el
     * check-then-act: la PK (seguidor_id, seguido_id) arbitra la carrera.
     */
    @Modifying
    @Query(value = """
            INSERT INTO seguidores (seguidor_id, seguido_id, fecha_inicio)
            VALUES (:seguidorId, :seguidoId, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertarSiFalta(@Param("seguidorId") Long seguidorId, @Param("seguidoId") Long seguidoId);
}
