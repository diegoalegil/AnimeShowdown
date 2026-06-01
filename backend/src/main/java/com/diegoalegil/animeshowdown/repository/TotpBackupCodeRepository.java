package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.TotpBackupCode;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface TotpBackupCodeRepository extends JpaRepository<TotpBackupCode, Long> {

    /** Codes (usados y no usados) de un usuario. Para iterar al validar. */
    List<TotpBackupCode> findByUsuario(Usuario usuario);

    /** Solo los no usados — los candidatos a validar contra el código que envía el cliente. */
    List<TotpBackupCode> findByUsuarioAndUsadoEnIsNull(Usuario usuario);

    long countByUsuarioAndUsadoEnIsNull(Usuario usuario);

    /**
     * Borra todos los códigos de un usuario. Se usa al regenerar el set
     * (invalida los anteriores) y al desactivar 2FA por completo.
     */
    @Modifying
    @Query("DELETE FROM TotpBackupCode b WHERE b.usuario = :usuario")
    int deleteByUsuario(@Param("usuario") Usuario usuario);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            UPDATE TotpBackupCode b
            SET b.usadoEn = :usadoEn
            WHERE b.id = :id
              AND b.usuario = :usuario
              AND b.usadoEn IS NULL
            """)
    int marcarUsadoSiDisponible(
            @Param("id") Long id,
            @Param("usuario") Usuario usuario,
            @Param("usadoEn") LocalDateTime usadoEn);
}
