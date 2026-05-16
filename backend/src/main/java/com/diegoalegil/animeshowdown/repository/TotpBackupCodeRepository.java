package com.diegoalegil.animeshowdown.repository;

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
}
