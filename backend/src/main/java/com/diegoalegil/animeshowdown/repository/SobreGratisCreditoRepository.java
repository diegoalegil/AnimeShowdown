package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.SobreGratisCredito;

import jakarta.persistence.LockModeType;

public interface SobreGratisCreditoRepository extends JpaRepository<SobreGratisCredito, Long> {

    /** Idempotencia del otorgamiento. */
    boolean existsByReferencia(String referencia);

    /** Créditos pendientes del usuario (sin consumir), más recientes primero. */
    List<SobreGratisCredito> findByUsuarioIdAndConsumidoEnIsNullOrderByCreatedAtDesc(Long usuarioId);

    /** Cuántos sobres gratis le quedan por abrir. */
    long countByUsuarioIdAndConsumidoEnIsNull(Long usuarioId);

    /** Carga con lock para consumir el crédito sin doble apertura concurrente. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM SobreGratisCredito c WHERE c.id = :id")
    Optional<SobreGratisCredito> findForUpdateById(@Param("id") Long id);
}
