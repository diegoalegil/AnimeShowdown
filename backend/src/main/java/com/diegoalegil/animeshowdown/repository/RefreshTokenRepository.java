package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.RefreshToken;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /** Lookup por hash — cómo el servicio valida un refresh entrante. */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * Revoca todas las sesiones activas de un usuario. Usado en
     * POST /auth/revoke-all (Plan v2 §1.3) y en cambio de contraseña
     * (invalidar sesiones previas tras password change).
     */
    @Modifying
    @Query("""
            UPDATE RefreshToken r
            SET r.revocadoEn = :ahora
            WHERE r.usuario = :usuario AND r.revocadoEn IS NULL
            """)
    int revocarTodosDelUsuario(@Param("usuario") Usuario usuario, @Param("ahora") LocalDateTime ahora);

    /**
     * Borra refresh tokens expirados o revocados hace más de 30 días.
     * Limpieza periódica para que la tabla no crezca indefinidamente. Se
     * llamará desde un cron o tarea programada futura (Bloque 2.6 con
     * scheduling). Por ahora queda accesible por si lo invocamos a mano.
     */
    @Modifying
    @Query("""
            DELETE FROM RefreshToken r
            WHERE r.expiraEn < :corte
               OR (r.revocadoEn IS NOT NULL AND r.revocadoEn < :corte)
            """)
    int borrarVencidos(@Param("corte") LocalDateTime corte);
}
