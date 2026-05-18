package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

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

    /** Total de favoritos del usuario — útil para el header de "mi roster". */
    long countByUsuario(Usuario usuario);

    /**
     * Para checks puntuales (GET /api/personajes/{slug}/favorito): trae
     * el row entero por si el caller quiere fecha + algo más. Si solo
     * necesitas el bool, usa existsByUsuarioAndPersonaje.
     */
    Optional<PersonajeFavorito> findByUsuarioAndPersonaje(Usuario usuario, Personaje personaje);
}
