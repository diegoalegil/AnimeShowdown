package com.diegoalegil.animeshowdown.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.EventoRecompensaEntregada;

public interface EventoRecompensaEntregadaRepository
        extends JpaRepository<EventoRecompensaEntregada, Long> {

    /** Idempotencia del reparto: ¿ya se premió a este usuario en esta copa? */
    boolean existsByTorneoIdAndUsuarioId(Long torneoId, Long usuarioId);
}
