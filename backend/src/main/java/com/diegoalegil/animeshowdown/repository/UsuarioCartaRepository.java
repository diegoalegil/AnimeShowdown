package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;

public interface UsuarioCartaRepository extends JpaRepository<UsuarioCarta, Long> {

    /** Colección del usuario con carta + personaje cargados (sin N+1). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    List<UsuarioCarta> findByUsuarioOrderByObtenidaEnDesc(Usuario usuario);

    /** Fila concreta usuario+carta para incrementar duplicados. */
    Optional<UsuarioCarta> findByUsuarioAndCarta(Usuario usuario, Carta carta);

    /** Cuántas cartas distintas posee el usuario (para el % de colección). */
    long countByUsuario(Usuario usuario);
}
