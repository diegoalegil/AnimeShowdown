package com.diegoalegil.animeshowdown.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveEstado;
import com.diegoalegil.animeshowdown.model.Usuario;

import jakarta.persistence.LockModeType;

public interface DueloLiveRepository extends JpaRepository<DueloLive, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM DueloLive d WHERE d.id = :id")
    Optional<DueloLive> findByIdForUpdate(@Param("id") Long id);

    /**
     * Carga el duelo con lock pesimista y fetching eagerly de ambos jugadores.
     * Este metodo es el unico entry-point legitimo a aplicarEloYFinalizar;
     * garantiza que la entidad esta locked y tiene sus relaciones cargadas
     * antes de cualquier modificacion al ELO.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM DueloLive d LEFT JOIN FETCH d.jugador1 LEFT JOIN FETCH d.jugador2 WHERE d.id = :id")
    Optional<DueloLive> findByIdForFinalize(@Param("id") Long id);

    @Query("""
            SELECT d FROM DueloLive d
            LEFT JOIN FETCH d.jugador1
            LEFT JOIN FETCH d.jugador2
            LEFT JOIN FETCH d.ganador
            LEFT JOIN FETCH d.abandonador
            WHERE d.id = :id
            """)
    Optional<DueloLive> findDetalleById(@Param("id") Long id);

    @Query("""
            SELECT d FROM DueloLive d
            LEFT JOIN FETCH d.jugador1
            WHERE d.estado = com.diegoalegil.animeshowdown.model.DueloLiveEstado.WAITING
            ORDER BY d.creadoEn ASC
            """)
    List<DueloLive> findWaitingOrderByCreadoEn();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT d FROM DueloLive d
            LEFT JOIN FETCH d.jugador1
            WHERE d.estado = com.diegoalegil.animeshowdown.model.DueloLiveEstado.WAITING
            ORDER BY d.creadoEn ASC
            """)
    List<DueloLive> findWaitingOrderByCreadoEnForUpdate();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT d FROM DueloLive d
            LEFT JOIN FETCH d.jugador1
            WHERE d.estado = com.diegoalegil.animeshowdown.model.DueloLiveEstado.WAITING
              AND d.creadoEn <= :limite
            ORDER BY d.creadoEn ASC
            """)
    List<DueloLive> findWaitingDueForUpdate(@Param("limite") LocalDateTime limite);

    @Query("""
            SELECT d FROM DueloLive d
            WHERE d.estado IN :estados
              AND (d.jugador1 = :usuario OR d.jugador2 = :usuario)
            ORDER BY d.creadoEn DESC
            """)
    List<DueloLive> findActivosDeUsuario(
            @Param("usuario") Usuario usuario,
            @Param("estados") List<DueloLiveEstado> estados,
            org.springframework.data.domain.Pageable pageable);

    @Query("""
            SELECT COUNT(d) FROM DueloLive d
            WHERE d.finishedEn >= :desde
              AND d.estado = com.diegoalegil.animeshowdown.model.DueloLiveEstado.FINISHED
              AND (d.jugador1 = :usuario OR d.jugador2 = :usuario)
            """)
    long countCompletadosDesde(@Param("usuario") Usuario usuario, @Param("desde") LocalDateTime desde);

    @Query("""
            SELECT COUNT(d) FROM DueloLive d
            WHERE d.finishedEn IS NOT NULL
              AND (d.jugador1 = :usuario OR d.jugador2 = :usuario)
            """)
    long countPartidosPvp(@Param("usuario") Usuario usuario);

    long countByEstadoIn(List<DueloLiveEstado> estados);

    List<DueloLive> findByEstadoIn(List<DueloLiveEstado> estados);
}
