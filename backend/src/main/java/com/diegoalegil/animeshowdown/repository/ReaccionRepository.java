package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Reaccion;
import com.diegoalegil.animeshowdown.model.ReaccionTargetType;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface ReaccionRepository extends JpaRepository<Reaccion, Long> {

    /** La reaction (única) que un usuario tiene sobre un target, si existe. */
    Optional<Reaccion> findByUsuarioAndTargetTypeAndTargetId(
            Usuario usuario, ReaccionTargetType targetType, Long targetId);

    long countByUsuarioAndTargetTypeAndTargetId(
            Usuario usuario, ReaccionTargetType targetType, Long targetId);

    /**
     * Conteo agrupado por tipo para un target. Devuelve {tipo, count} para
     * cada tipo que tiene al menos una reaction. Tipos con cero no salen —
     * el caller los completa con cero en el DTO.
     *
     * Object[] {ReaccionTipo, Long}.
     */
    @Query("""
            SELECT r.tipo, COUNT(r)
            FROM Reaccion r
            WHERE r.targetType = :targetType AND r.targetId = :targetId
            GROUP BY r.tipo
            """)
    List<Object[]> contarPorTipo(
            @Param("targetType") ReaccionTargetType targetType,
            @Param("targetId") Long targetId);

    /**
     * Inserta la reacción de forma atómica idempotente (ON CONFLICT DO NOTHING sobre
     * uk_reacciones_par): 1 si era nueva, 0 si una petición concurrente la creó a la
     * vez. No lanza (un INSERT plano + catch reventaría la tx en Postgres), así que el
     * service ya no necesita el mutex global para serializar el check-then-act; tras un
     * 0, re-lee y reconcilia el tipo.
     */
    @Modifying
    @Query(value = """
            INSERT INTO reacciones (usuario_id, tipo, target_type, target_id, fecha)
            VALUES (:usuarioId, :tipo, :targetType, :targetId, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertarSiFalta(@Param("usuarioId") Long usuarioId, @Param("tipo") String tipo,
            @Param("targetType") String targetType, @Param("targetId") Long targetId);
}
