package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;

import jakarta.persistence.LockModeType;

public interface UsuarioCartaRepository extends JpaRepository<UsuarioCarta, Long> {

    /** Colección del usuario con carta + personaje cargados (sin N+1). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    List<UsuarioCarta> findByUsuarioOrderByObtenidaEnDesc(Usuario usuario);

    /** Fila concreta usuario+carta para incrementar duplicados. */
    Optional<UsuarioCarta> findByUsuarioAndCarta(Usuario usuario, Carta carta);

    /** Gate de propiedad para endpoints que no deben filtrar cartas no poseídas. */
    boolean existsByUsuarioIdAndCartaId(Long usuarioId, Long cartaId);

    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    Optional<UsuarioCarta> findByUsuarioIdAndCartaId(Long usuarioId, Long cartaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    @Query("""
            SELECT uc
            FROM UsuarioCarta uc
            WHERE uc.usuario.id = :usuarioId AND uc.carta.id = :cartaId
            """)
    Optional<UsuarioCarta> findForUpdateByUsuarioIdAndCartaId(
            @Param("usuarioId") Long usuarioId,
            @Param("cartaId") Long cartaId);

    /** Cuántas cartas distintas posee el usuario (para el % de colección). */
    long countByUsuario(Usuario usuario);
}
