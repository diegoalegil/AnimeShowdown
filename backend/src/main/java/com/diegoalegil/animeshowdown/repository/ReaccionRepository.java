package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
