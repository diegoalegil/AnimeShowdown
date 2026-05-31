package com.diegoalegil.animeshowdown.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Notificacion;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface NotificacionRepository extends JpaRepository<Notificacion, Long> {

    /** Listado paginado del usuario, ordenado por fecha desc (más reciente primero). */
    Page<Notificacion> findByUsuarioOrderByCreadoEnDesc(Usuario usuario, Pageable pageable);

    /** Solo las no leídas, para el dropdown de la campanita. */
    Page<Notificacion> findByUsuarioAndLeidaFalseOrderByCreadoEnDesc(Usuario usuario, Pageable pageable);

    /** Count de no leídas — el badge del header. Query simple, index cubre. */
    long countByUsuarioAndLeidaFalse(Usuario usuario);

    boolean existsByUsuarioAndTipoAndCreadoEnAfter(Usuario usuario, NotificacionTipo tipo,
            java.time.LocalDateTime desde);

    /** Marca todas las del usuario como leídas. Una sola escritura. */
    @Modifying
    @Query("UPDATE Notificacion n SET n.leida = true WHERE n.usuario = :usuario AND n.leida = false")
    int marcarTodasLeidasPorUsuario(@Param("usuario") Usuario usuario);
}
