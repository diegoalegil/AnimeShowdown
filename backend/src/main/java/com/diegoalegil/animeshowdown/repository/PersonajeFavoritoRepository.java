package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.PersonajeFavorito;
import com.diegoalegil.animeshowdown.model.PersonajeFavorito.PersonajeFavoritoId;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface PersonajeFavoritoRepository
        extends JpaRepository<PersonajeFavorito, PersonajeFavoritoId> {

    /**
     * Roster del usuario ordenado por fecha de seguimiento DESC (más
     * reciente primero — el orden natural para mostrar "mi roster").
     * JOIN FETCH sobre personaje para evitar N+1 al mapear a DTO.
     */
    @Query("""
            SELECT pf FROM PersonajeFavorito pf
            JOIN FETCH pf.personaje
            WHERE pf.usuario = :usuario
            ORDER BY pf.createdAt DESC
            """)
    List<PersonajeFavorito> findRosterByUsuario(@Param("usuario") Usuario usuario);

    /** Test si un usuario sigue a un personaje concreto. */
    boolean existsByUsuarioAndPersonaje(Usuario usuario, Personaje personaje);

    /**
     * Borrado idempotente del favorito: si no existía, returns 0 rows.
     * Sin fetch previo, solo un DELETE WHERE — más rápido que cargar
     * entity y borrarla.
     */
    @Modifying
    @Query("""
            DELETE FROM PersonajeFavorito pf
            WHERE pf.usuario = :usuario AND pf.personaje = :personaje
            """)
    int deleteByUsuarioAndPersonaje(
            @Param("usuario") Usuario usuario,
            @Param("personaje") Personaje personaje);

    /**
     * Inserta el favorito de forma atómica idempotente (ON CONFLICT DO NOTHING):
     * 1 si era nuevo, 0 si ya existía o si dos peticiones carreran. No lanza, así que
     * NO necesita el mutex global: la PK (usuario_id, personaje_id) arbitra la carrera.
     */
    @Modifying
    @Query(value = """
            INSERT INTO personajes_favoritos (usuario_id, personaje_id, created_at)
            VALUES (:usuarioId, :personajeId, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertarSiFalta(@Param("usuarioId") Long usuarioId, @Param("personajeId") Long personajeId);

    /** Total de favoritos del usuario — útil para el header de "mi roster". */
    long countByUsuario(Usuario usuario);

    /**
     * Para checks puntuales (GET /api/personajes/{slug}/favorito): trae
     * el row entero por si el caller quiere fecha + algo más. Si solo
     * necesitas el bool, usa existsByUsuarioAndPersonaje.
     */
    Optional<PersonajeFavorito> findByUsuarioAndPersonaje(Usuario usuario, Personaje personaje);

    /**
     * IDs de personajes que tiene al menos un usuario como favorito. Lo usa
     * el scheduler de alertas de movimiento para acotar el cálculo de deltas
     * a personajes con audiencia (en vez de todo el catálogo).
     */
    @Query("SELECT DISTINCT pf.personaje.id FROM PersonajeFavorito pf")
    List<Long> findPersonajeIdsConSeguidores();

    /**
     * Usuarios que tienen un personaje como favorito, ordenados por antigüedad
     * del favorito. Paginado para acotar el fan-out de alertas a un tope por
     * personaje (un personaje muy seguido no debe generar un pico de escrituras).
     */
    @Query("""
            SELECT pf.usuario FROM PersonajeFavorito pf
            WHERE pf.personaje.id = :personajeId
            ORDER BY pf.createdAt ASC
            """)
    List<Usuario> findUsuariosByPersonajeId(@Param("personajeId") Long personajeId, Pageable pageable);
}
