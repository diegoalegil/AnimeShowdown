package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Torneo;

public interface TorneoRepository extends JpaRepository<Torneo, Long> {

    /**
     * Torneos cuyo prefijo de descripción coincida con el dado (típicamente
     * "[AUTO]"), filtrados por fechaCreacion posterior al umbral. Reemplaza
     * findAll().stream().filter() en TorneoAutoService que leía la tabla
     * entera y filtraba en memoria — con miles de torneos eso sería un
     * desastre. La query la resuelve Postgres usando el índice de
     * fechaCreacion.
     */
    @Query("""
            SELECT t FROM Torneo t
            WHERE t.descripcion LIKE CONCAT(:prefix, '%')
              AND t.fechaCreacion > :desde
            ORDER BY t.fechaCreacion DESC
            """)
    List<Torneo> findAutoTorneosDesde(
            @Param("prefix") String prefix,
            @Param("desde") LocalDateTime desde);

    /** Cuenta total de torneos con un prefijo concreto en la descripción. */
    @Query("SELECT COUNT(t) FROM Torneo t WHERE t.descripcion LIKE CONCAT(:prefix, '%')")
    long countByDescripcionPrefix(@Param("prefix") String prefix);

    /** Atajo a findAutoTorneosDesde con LIMIT lógico 1 (el más reciente). */
    default Optional<Torneo> findAutoTorneoMasRecienteDesde(String prefix, LocalDateTime desde) {
        List<Torneo> resultados = findAutoTorneosDesde(prefix, desde);
        return resultados.isEmpty() ? Optional.empty() : Optional.of(resultados.get(0));
    }
}
