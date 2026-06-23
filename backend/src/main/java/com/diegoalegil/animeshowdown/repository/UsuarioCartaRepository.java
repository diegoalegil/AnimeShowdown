package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;

import jakarta.persistence.LockModeType;

public interface UsuarioCartaRepository extends JpaRepository<UsuarioCarta, Long> {

    /** Colección del usuario con carta + personaje cargados (sin N+1). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    List<UsuarioCarta> findByUsuarioOrderByObtenidaEnDesc(Usuario usuario);

    /** Posesiones mínimas para pintar la colección sin cargar carta/personaje. */
    @Query("""
            select new com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem(
                uc.carta.id,
                uc.cantidad)
            from UsuarioCarta uc
            where uc.usuario = :usuario
            order by uc.obtenidaEn desc
            """)
    List<UsuarioCartaPosesionItem> findPosesionesByUsuario(@Param("usuario") Usuario usuario);

    /** Fila concreta usuario+carta para incrementar duplicados. */
    Optional<UsuarioCarta> findByUsuarioAndCarta(Usuario usuario, Carta carta);

    /**
     * Incrementa atómicamente la cantidad de la fila usuario+carta en BD
     * ({@code UPDATE ... SET cantidad = cantidad + 1}). Devuelve el número de
     * filas afectadas: 1 si la posesión ya existía (incrementada sin lost-update),
     * 0 si todavía no existe. Evita el read-modify-write que pierde incrementos
     * cuando dos concesiones de la misma carta corren a la vez sobre el mismo
     * usuario.
     */
    @Modifying(flushAutomatically = true)
    @Query("update UsuarioCarta uc set uc.cantidad = uc.cantidad + 1 "
            + "where uc.usuario = :usuario and uc.carta = :carta")
    int incrementarCantidad(@Param("usuario") Usuario usuario, @Param("carta") Carta carta);

    /**
     * Inserta la posesión usuario+carta de forma atómica e idempotente. El
     * {@code ON CONFLICT DO NOTHING} evita la excepción de UNIQUE
     * ({@code uk_usuario_carta}) cuando dos aperturas concurrentes del mismo
     * usuario+carta insertan a la vez — esa excepción reventaría con 500 y, peor,
     * envenenaría la transacción de apertura del sobre (rollback-only). Devuelve
     * filas afectadas: 1 si la insertamos nosotros (carta NUEVA), 0 si ya existía
     * (carrera: otra apertura la creó; el llamante la trata como duplicado). Las
     * columnas NOT NULL se rellenan explícitas porque {@code @PrePersist} no corre
     * en query nativa. Mismo patrón dual H2/Postgres que
     * {@code PersonajeVotoScoreRepository.insertarSiFalta}.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO usuario_carta (usuario_id, carta_id, cantidad, obtenida_en, actualizada_en, destacada)
            VALUES (:usuarioId, :cartaId, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertarPosesionSiFalta(@Param("usuarioId") Long usuarioId, @Param("cartaId") Long cartaId);

    /** Gate de propiedad para endpoints que no deben filtrar cartas no poseídas. */
    boolean existsByUsuarioIdAndCartaId(Long usuarioId, Long cartaId);

    /** Fila usuario+carta por ids, útil para asserts y flujos server-authoritative. */
    Optional<UsuarioCarta> findByUsuarioIdAndCartaId(Long usuarioId, Long cartaId);

    /** Fila usuario+carta bloqueada para transferencias atómicas de trading. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    @Query("""
            select uc
            from UsuarioCarta uc
            where uc.usuario.id = :usuarioId and uc.carta.id = :cartaId
            """)
    Optional<UsuarioCarta> findForUpdateByUsuarioIdAndCartaId(
            @Param("usuarioId") Long usuarioId,
            @Param("cartaId") Long cartaId);

    /** Cuántas cartas distintas posee el usuario (para el % de colección). */
    long countByUsuario(Usuario usuario);

    /** Fila usuario+carta por id de carta (gate de propiedad al destacar). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    Optional<UsuarioCarta> findByUsuarioAndCartaId(Usuario usuario, Long cartaId);

    /** La carta destacada actual del usuario (a lo sumo una). */
    @EntityGraph(attributePaths = {"carta", "carta.personaje"})
    Optional<UsuarioCarta> findByUsuarioAndDestacadaTrue(Usuario usuario);
}
