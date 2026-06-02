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

    Optional<PasswordResetToken> findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(Long usuarioId);

    long countByUsuarioIdAndCreadoEnAfter(Long usuarioId, LocalDateTime creadoEn);

    @Modifying
    @Transactional
    @Query("DELETE FROM PasswordResetToken t WHERE t.usuarioId = :usuarioId")
    void deleteAllByUsuarioId(@Param("usuarioId") Long usuarioId);

    @Modifying
    @Transactional
    @Query("""
            UPDATE PasswordResetToken t
            SET t.usado = true,
                t.usadoEn = :usadoEn
            WHERE t.usuarioId = :usuarioId
              AND t.usado = false
            """)
    int marcarTodosComoUsadosByUsuarioId(
            @Param("usuarioId") Long usuarioId,
            @Param("usadoEn") LocalDateTime usadoEn);

    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE password_reset_tokens
            SET usado = TRUE,
                usado_en = :usadoEn
            WHERE id = :id
              AND usado = FALSE
              AND expira_en >= :ahora
              AND intentos_fallidos < :maxIntentos
            """, nativeQuery = true)
    int consumirActivoPorId(
            @Param("id") Long id,
            @Param("ahora") LocalDateTime ahora,
            @Param("usadoEn") LocalDateTime usadoEn,
            @Param("maxIntentos") int maxIntentos);

    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE password_reset_tokens
            SET intentos_fallidos = intentos_fallidos + 1,
                usado = CASE WHEN intentos_fallidos + 1 >= :maxIntentos THEN TRUE ELSE usado END,
                usado_en = CASE WHEN intentos_fallidos + 1 >= :maxIntentos THEN :usadoEn ELSE usado_en END
            WHERE id = :id
              AND usado = FALSE
            """, nativeQuery = true)
    int registrarIntentoFallido(
            @Param("id") Long id,
            @Param("maxIntentos") int maxIntentos,
            @Param("usadoEn") LocalDateTime usadoEn);
}
