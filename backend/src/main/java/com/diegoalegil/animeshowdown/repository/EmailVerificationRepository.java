package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.EmailVerification;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {

    /** Lookup por token plano — se usa al verificar el link del email. */
    Optional<EmailVerification> findByToken(String token);

    /**
     * Limpieza periódica: borra tokens expirados o usados hace más de 7
     * días. La invocará un cron del Bloque 16 cuando llegue scheduling.
     * Por ahora queda accesible para llamar a mano.
     */
    @Modifying
    @Query("""
            DELETE FROM EmailVerification v
            WHERE v.expiraEn < :corte
               OR (v.usadoEn IS NOT NULL AND v.usadoEn < :corte)
            """)
    int borrarVencidos(@Param("corte") LocalDateTime corte);

    /**
     * Invalida (marca como usadas) todas las verificaciones activas del
     * usuario. Útil al pedir reenvío para que el token nuevo sea el único
     * válido.
     */
    @Modifying
    @Query("""
            UPDATE EmailVerification v
            SET v.usadoEn = :ahora
            WHERE v.usuario = :usuario AND v.usadoEn IS NULL
            """)
    int invalidarActivasDelUsuario(@Param("usuario") Usuario usuario, @Param("ahora") LocalDateTime ahora);
}
