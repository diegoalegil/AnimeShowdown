package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Usuario;

import jakarta.persistence.LockModeType;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByUsername(String username);

    Optional<Usuario> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id")
    Optional<Usuario> findForUpdateById(@Param("id") Long id);

    /**
     * V-8: cuenta usuarios con el mismo username (case-insensitive) que NO sean
     * el indicado. Sirve para la unicidad del cambio de username sin chocar con
     * uno mismo —y tolera colisiones de mayúsculas legacy, donde un
     * findByUsernameIgnoreCase devolvería más de una fila—.
     */
    @Query("SELECT COUNT(u) FROM Usuario u WHERE LOWER(u.username) = LOWER(:username) AND u.id <> :excludeId")
    long countByUsernameIgnoreCaseExcludingId(String username, Long excludeId);

    /** 8: lookup por código de referral en el registro. */
    Optional<Usuario> findByReferralCode(String referralCode);

    /** Count de referidos verificados. */
    @Query("SELECT COUNT(u) FROM Usuario u WHERE u.referredBy.id = :referrerId AND u.estadoVerificacion = com.diegoalegil.animeshowdown.model.EstadoVerificacion.ACTIVO")
    long countReferidosVerificadosByReferrerId(Long referrerId);

    /** Backfill V14: usuarios sin código que necesitan uno. */
    List<Usuario> findByReferralCodeIsNull();

    /**
     * Proyección ligera para sitemap: solo username + fechaRegistro.
     * Evita cargar password, email, TOTP, avatarUrl y todos los campos
     * sensibles de la entidad Usuario. El endpoint es público (permitAll).
     */
    @Query("SELECT new com.diegoalegil.animeshowdown.dto.UsuarioSitemapDto(u.username, u.fechaRegistro) FROM Usuario u")
    List<com.diegoalegil.animeshowdown.dto.UsuarioSitemapDto> findAllPublico();
}
