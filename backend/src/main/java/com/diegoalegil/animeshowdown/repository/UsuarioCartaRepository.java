package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;

public interface UsuarioCartaRepository extends JpaRepository<UsuarioCarta, Long> {

    /** Colección del usuario con carta + personaje cargados (sin N+1). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    List<UsuarioCarta> findByUsuarioOrderByObtenidaEnDesc(Usuario usuario);

    /** Posesiones mínimas para pintar la colección sin cargar carta/personaje. */
    @Query("""
            select new com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem(
                uc.carta.id,
                uc.cantidad)
            from UsuarioCarta uc
            where uc.usuario = :usuario
            order by uc.obtenidaEn desc
            """)
    List<UsuarioCartaPosesionItem> findPosesionesByUsuario(@Param("usuario") Usuario usuario);

    /** Fila concreta usuario+carta para incrementar duplicados. */
    Optional<UsuarioCarta> findByUsuarioAndCarta(Usuario usuario, Carta carta);

    /** Gate de propiedad para endpoints que no deben filtrar cartas no poseídas. */
    boolean existsByUsuarioIdAndCartaId(Long usuarioId, Long cartaId);

    /** Cuántas cartas distintas posee el usuario (para el % de colección). */
    long countByUsuario(Usuario usuario);

    /** Fila usuario+carta por id de carta (gate de propiedad al destacar). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    Optional<UsuarioCarta> findByUsuarioAndCartaId(Usuario usuario, Long cartaId);

    /** La carta destacada actual del usuario (a lo sumo una). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    Optional<UsuarioCarta> findByUsuarioAndDestacadaTrue(Usuario usuario);
}
