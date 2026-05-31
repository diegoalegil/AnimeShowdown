package com.diegoalegil.animeshowdown.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.UsuarioCartaPity;

import jakarta.persistence.LockModeType;

public interface UsuarioCartaPityRepository extends JpaRepository<UsuarioCartaPity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from UsuarioCartaPity p where p.usuarioId = :usuarioId")
    Optional<UsuarioCartaPity> findForUpdateByUsuarioId(@Param("usuarioId") Long usuarioId);
}
