package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.TierList;

public interface TierListRepository extends JpaRepository<TierList, Long> {

    boolean existsBySlug(String slug);

    @EntityGraph(attributePaths = {"usuario", "items", "items.personaje"})
    @Query("SELECT DISTINCT tl FROM TierList tl WHERE tl.usuario.id = :usuarioId ORDER BY tl.updatedAt DESC")
    List<TierList> findByUsuarioIdOrderByUpdatedAtDesc(@Param("usuarioId") Long usuarioId);

    @EntityGraph(attributePaths = {"usuario", "items", "items.personaje"})
    @Query("SELECT tl FROM TierList tl WHERE tl.id = :id AND tl.usuario.id = :usuarioId")
    Optional<TierList> findOwnWithItems(@Param("id") Long id, @Param("usuarioId") Long usuarioId);

    @EntityGraph(attributePaths = {"usuario", "items", "items.personaje"})
    Optional<TierList> findBySlugAndPublicoTrue(String slug);
}
