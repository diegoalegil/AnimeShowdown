package com.diegoalegil.animeshowdown.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.SobreApertura;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface SobreAperturaRepository extends JpaRepository<SobreApertura, Long> {

    @EntityGraph(attributePaths = {"items", "items.carta", "items.carta.personaje"})
    Optional<SobreApertura> findByUsuarioAndIdempotencyKey(Usuario usuario, String idempotencyKey);
}
