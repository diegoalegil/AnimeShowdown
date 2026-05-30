package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;
import com.diegoalegil.animeshowdown.model.Voto;

/**
 * Queries del feed de comunidad (B7 §2). Agregado independiente para no
 * tocar los repos por-entidad. Usa {@code JOIN FETCH} (no {@code @EntityGraph},
 * que se resolvería contra el tipo raíz del repo) para cargar autor +
 * relaciones en una sola query y evitar N+1. Todos los fetch son to-one, así
 * que la paginación se aplica en SQL (sin warning de colección en memoria).
 * Solo lectura.
 */
public interface FeedRepository extends Repository<Voto, Long> {

    /** Votos recientes de los usuarios seguidos, con autor + enfrentamiento. */
    @Query("SELECT v FROM Voto v "
            + "JOIN FETCH v.usuario "
            + "LEFT JOIN FETCH v.personaje "
            + "LEFT JOIN FETCH v.enfrentamiento e "
            + "LEFT JOIN FETCH e.personaje1 "
            + "LEFT JOIN FETCH e.personaje2 "
            + "LEFT JOIN FETCH e.torneo "
            + "WHERE v.usuario IN :usuarios ORDER BY v.fecha DESC")
    List<Voto> feedVotos(@Param("usuarios") List<Usuario> usuarios, Pageable pageable);

    /** Logros desbloqueados recientemente por los usuarios seguidos. */
    @Query("SELECT ul FROM UsuarioLogro ul "
            + "JOIN FETCH ul.usuario JOIN FETCH ul.logro "
            + "WHERE ul.usuario IN :usuarios ORDER BY ul.desbloqueadoEn DESC")
    List<UsuarioLogro> feedLogros(@Param("usuarios") List<Usuario> usuarios, Pageable pageable);

    /**
     * Torneos recientes creados por los usuarios seguidos. Solo públicos y
     * APROBADOS —los PENDIENTE/RECHAZADO no deben filtrarse a los seguidores—.
     */
    @Query("SELECT t FROM Torneo t JOIN FETCH t.creadoPor "
            + "WHERE t.creadoPor IN :creadores AND t.estadoRevision = :revision AND t.publico = true "
            + "ORDER BY t.fechaCreacion DESC")
    List<Torneo> feedTorneos(@Param("creadores") List<Usuario> creadores,
            @Param("revision") EstadoRevision revision, Pageable pageable);
}
