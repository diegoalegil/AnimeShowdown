package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.diegoalegil.animeshowdown.model.Usuario;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByUsername(String username);

    Optional<Usuario> findByEmail(String email);

    /** Plan v2 §11.8: lookup por código de referral en el registro. */
    Optional<Usuario> findByReferralCode(String referralCode);

    /** Count de referidos verificados (Plan v2 §11.8, tier del badge reclutador). */
    @Query("SELECT COUNT(u) FROM Usuario u WHERE u.referredBy.id = :referrerId AND u.estadoVerificacion = com.diegoalegil.animeshowdown.model.EstadoVerificacion.ACTIVO")
    long countReferidosVerificadosByReferrerId(Long referrerId);

    /** Backfill V14: usuarios sin código que necesitan uno. */
    List<Usuario> findByReferralCodeIsNull();
}
