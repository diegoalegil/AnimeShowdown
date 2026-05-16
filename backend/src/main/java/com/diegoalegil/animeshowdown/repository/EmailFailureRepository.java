package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.EmailFailure;

public interface EmailFailureRepository extends JpaRepository<EmailFailure, Long> {

    /** Listado ordenado más reciente primero — para el dashboard admin. */
    List<EmailFailure> findAllByOrderByTsDesc();

    /** Cuenta de fallos no reintentados — métrica de severidad rápida. */
    long countByReintentadoFalse();
}
