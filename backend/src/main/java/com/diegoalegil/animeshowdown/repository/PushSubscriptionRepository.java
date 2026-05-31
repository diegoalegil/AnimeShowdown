package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.PushSubscription;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUsuario(Usuario usuario);

    @Query("""
            SELECT ps
            FROM PushSubscription ps
            JOIN FETCH ps.usuario
            """)
    List<PushSubscription> findAllFetchUsuario();

    @Modifying
    int deleteByUsuarioAndEndpoint(Usuario usuario, String endpoint);

    @Modifying
    @Query("DELETE FROM PushSubscription ps WHERE ps.usuario = :usuario")
    int deleteByUsuario(@Param("usuario") Usuario usuario);
}
