package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.PasswordResetToken;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findFirstByUsuarioIdAndCodigoAndUsadoFalseOrderByCreadoEnDesc(
            Long usuarioId, String codigo);

    long countByUsuarioIdAndCreadoEnAfter(Long usuarioId, LocalDateTime creadoEn);

    @Modifying
    @Transactional
    @Query("DELETE FROM PasswordResetToken t WHERE t.usuarioId = :usuarioId")
    void deleteAllByUsuarioId(@Param("usuarioId") Long usuarioId);

    @Modifying
    @Transactional
    @Query("UPDATE PasswordResetToken t SET t.usado = true WHERE t.usuarioId = :usuarioId AND t.usado = false")
    int marcarTodosComoUsadosByUsuarioId(@Param("usuarioId") Long usuarioId);
}
