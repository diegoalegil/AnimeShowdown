package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.FantasyEquipo;
import com.diegoalegil.animeshowdown.model.Usuario;

import jakarta.persistence.LockModeType;

public interface FantasyEquipoRepository extends JpaRepository<FantasyEquipo, Long> {

    @EntityGraph(attributePaths = {"items", "items.personaje"})
    Optional<FantasyEquipo> findByUsuarioAndSemanaIso(Usuario usuario, String semanaIso);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT DISTINCT e
            FROM FantasyEquipo e
            LEFT JOIN FETCH e.items i
            LEFT JOIN FETCH i.personaje
            WHERE e.usuario = :usuario AND e.semanaIso = :semanaIso
            """)
    Optional<FantasyEquipo> findByUsuarioAndSemanaIsoForUpdate(
            @Param("usuario") Usuario usuario,
            @Param("semanaIso") String semanaIso);

    @EntityGraph(attributePaths = {"usuario", "items", "items.personaje"})
    List<FantasyEquipo> findBySemanaIso(String semanaIso);

    @EntityGraph(attributePaths = {"usuario", "items", "items.personaje"})
    List<FantasyEquipo> findBySemanaIsoAndLockedAtIsNotNull(String semanaIso);

    @EntityGraph(attributePaths = {"usuario", "items", "items.personaje"})
    List<FantasyEquipo> findBySemanaIsoAndLockedAtIsNotNullOrderByPuntosDescIdAsc(
            String semanaIso,
            Pageable pageable);
}
