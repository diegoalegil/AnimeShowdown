package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;

public interface VotoRepository extends JpaRepository<Voto, Long> {

    /**
     * Ranking all-time por votos (Plan v2 §4.6).
     *
     * <p>Audit fix #15 (2026-05-21): se anade desempate por id ASC. Sin
     * tiebreak, dos personajes con el mismo COUNT salian en orden
     * arbitrario del dialecto SQL — el frontend mostraba a veces #4
     * "Naruto", a veces "Sasuke" para el mismo dataset. Con tiebreak
     * estable, el orden es determinista en H2, Postgres y queries
     * paginadas (sin riesgo de duplicar/saltar entries entre paginas).
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(v.personaje, COUNT(v))
            FROM Voto v
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC, v.personaje.id ASC
            """)
    List<RankingItem> obtenerRanking();

    /**
     * Ranking all-time paginado (Plan v2 §4.6). Page para que la UI pueda
     * pedir top 50 o top 100 sin volcar todo el catálogo.
     */
    @Query(value = """
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(v.personaje, COUNT(v))
            FROM Voto v
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC, v.personaje.id ASC
            """,
            countQuery = "SELECT COUNT(DISTINCT v.personaje) FROM Voto v")
    org.springframework.data.domain.Page<RankingItem> rankingAllTime(
            org.springframework.data.domain.Pageable pageable);

    /**
     * Ranking dentro de una ventana temporal (Plan v2 §4.6 — top mensual,
     * trimestral, etc). desde es inclusivo. Aplica el mismo GROUP BY que
     * el all-time pero filtra por fecha del voto.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(v.personaje, COUNT(v))
            FROM Voto v
            WHERE v.fecha >= :desde
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC, v.personaje.id ASC
            """)
    List<RankingItem> rankingDesde(@Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Ranking "histórico" (Plan v2 §4.x — indicadores ↑↓): cuenta solo
     * votos EMITIDOS antes de la fecha dada. Sirve para comparar la
     * posición de hace N días con la posición actual y calcular el
     * movimiento de cada personaje.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(v.personaje, COUNT(v))
            FROM Voto v
            WHERE v.fecha < :antesDe
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC, v.personaje.id ASC
            """)
    List<RankingItem> rankingHasta(@Param("antesDe") java.time.LocalDateTime antesDe,
            org.springframework.data.domain.Pageable pageable);

    /** Total de votos de un personaje (Plan v2 §11.1 time machine baseline). */
    long countByPersonajeId(Long personajeId);

    /**
     * Cuenta votos del personaje dentro del rango [desde, hasta) — desde
     * inclusivo, hasta exclusivo para que el caller pueda concatenar
     * periodos sin solape. Plan producto 2026-05-18 (sprint actividad
     * reciente): usado por VotosPeriodoService para calcular delta entre
     * periodo actual y anterior.
     */
    @Query("""
            SELECT COUNT(v)
            FROM Voto v
            WHERE v.personaje.id = :personajeId
              AND v.fecha >= :desde
              AND v.fecha < :hasta
            """)
    long countByPersonajeIdInRange(
            @Param("personajeId") Long personajeId,
            @Param("desde") java.time.LocalDateTime desde,
            @Param("hasta") java.time.LocalDateTime hasta);

    /**
     * Versión batch: cuenta votos para una lista de personajes en el
     * rango [desde, hasta). Devuelve {@code [personajeId, count]} por
     * cada personaje con AL MENOS 1 voto en el rango — los que tienen
     * 0 NO aparecen (caller debe asumir 0 para los ausentes).
     *
     * <p>Una sola query SQL por rango × lista, evita N+1 desde el
     * frontend cuando muestra "+N votos esta semana" sobre múltiples
     * personajes a la vez (Pulso Movers, FavoritosBanner).
     */
    @Query("""
            SELECT v.personaje.id, COUNT(v)
            FROM Voto v
            WHERE v.personaje.id IN :personajeIds
              AND v.fecha >= :desde
              AND v.fecha < :hasta
            GROUP BY v.personaje.id
            """)
    List<Object[]> countByPersonajeIdsInRange(
            @Param("personajeIds") java.util.Collection<Long> personajeIds,
            @Param("desde") java.time.LocalDateTime desde,
            @Param("hasta") java.time.LocalDateTime hasta);

    /**
     * Votos por día del personaje desde la fecha dada (Plan v2 §11.1).
     * Devuelve {@code [fechaInicio-del-día, count]}.
     *
     * <p>Audit fix #2 (2026-05-21): antes usaba {@code FUNCTION('DATE', v.fecha)}
     * — esa función delegaba al dialecto SQL. En H2 se traducía a
     * {@code date(...)}, que H2 no reconoce; el endpoint
     * {@code /api/personajes/:slug/elo-history} devolvía 500 y el
     * frontend silenciaba el fallo (chart desaparecía sin mensaje). En
     * Postgres sí funcionaba, así que solo se veía en tests/dev.
     *
     * <p>Ahora usamos {@code CAST(v.fecha AS java.time.LocalDate)} —
     * sintaxis estándar JPA 3.0+ / Hibernate 6 que ambos dialectos
     * resuelven correctamente.
     */
    @Query("""
            SELECT CAST(v.fecha AS java.time.LocalDate), COUNT(v)
            FROM Voto v
            WHERE v.personaje.id = :personajeId
              AND v.fecha >= :desde
            GROUP BY CAST(v.fecha AS java.time.LocalDate)
            ORDER BY CAST(v.fecha AS java.time.LocalDate) ASC
            """)
    List<Object[]> votosPorDiaDesde(@Param("personajeId") Long personajeId,
            @Param("desde") java.time.LocalDateTime desde);

    /**
     * Ranking de personajes de un anime concreto (Plan v2 §4.6). Filtramos
     * por nombre del anime (string del catálogo) — case-sensitive porque
     * los nombres en BBDD vienen consistentes del seeder.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(v.personaje, COUNT(v))
            FROM Voto v
            WHERE v.personaje.anime = :anime
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC, v.personaje.id ASC
            """)
    List<RankingItem> rankingPorAnime(@Param("anime") String anime,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Lista única de animes que han recibido al menos un voto. Útil para
     * popular el dropdown del tab "Por anime" en /ranking — no queremos
     * mostrar 200 animes vacíos.
     */
    @Query("""
            SELECT DISTINCT v.personaje.anime
            FROM Voto v
            ORDER BY v.personaje.anime ASC
            """)
    List<String> animesConVotos();

    boolean existsByPersonajeAndUsuario(Personaje personaje, Usuario usuario);

    boolean existsByEnfrentamientoAndUsuario(Enfrentamiento enfrentamiento, Usuario usuario);

    /** Total de votos emitidos por un usuario. Plan v2 §4.2 (badges por umbral). */
    long countByUsuario(Usuario usuario);

    /**
     * Top voters all-time (Plan v2 §11.9). Devuelve {Usuario, Long total}
     * ordenado descendente. Usado por GET /api/votos/top-voters?limit=10
     * para la página /leaderboards/voters.
     */
    @Query("""
            SELECT v.usuario, COUNT(v)
            FROM Voto v
            WHERE v.usuario IS NOT NULL
            GROUP BY v.usuario
            ORDER BY COUNT(v) DESC, v.usuario.id ASC
            """)
    List<Object[]> topVoters(org.springframework.data.domain.Pageable pageable);

    /**
     * Top voters de los últimos N días (semanal/mensual). Mismo shape que
     * topVoters pero con WHERE fecha > :desde para ventana temporal.
     */
    @Query("""
            SELECT v.usuario, COUNT(v)
            FROM Voto v
            WHERE v.usuario IS NOT NULL AND v.fecha > :desde
            GROUP BY v.usuario
            ORDER BY COUNT(v) DESC, v.usuario.id ASC
            """)
    List<Object[]> topVotersDesde(
            @Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    long countByEnfrentamientoAndPersonaje(Enfrentamiento enfrentamiento, Personaje personaje);

    /**
     * Feed público de los últimos N votos, con personaje + enfrentamiento +
     * usuario fetcheados eagerly para evitar N+1 al mapear a VotoFeedItem.
     *
     * <p>Plan producto (2026-05-18): consumido por SectionPulso en la home
     * para mostrar actividad real ("X votó por Y vs Z hace 2 min"). Sin
     * filtro de usuario — el feed incluye votos anónimos (frontend los
     * etiqueta como "alguien"). Pageable acota a un puñado de items para
     * no traer toda la tabla.
     */
    @Query("""
            SELECT v FROM Voto v
            LEFT JOIN FETCH v.personaje
            LEFT JOIN FETCH v.usuario
            LEFT JOIN FETCH v.enfrentamiento e
            LEFT JOIN FETCH e.personaje1
            LEFT JOIN FETCH e.personaje2
            ORDER BY v.fecha DESC
            """)
    List<Voto> findRecentesParaFeed(org.springframework.data.domain.Pageable pageable);

    /**
     * Historial de votos del usuario, ordenados por fecha desc (más recientes
     * primero). Page para paginación; el frontend pide page=0,size=50 típicamente.
     * Plan v2 §4.1.
     */
    org.springframework.data.domain.Page<Voto> findByUsuarioOrderByFechaDesc(
            Usuario usuario, org.springframework.data.domain.Pageable pageable);

    /**
     * Top N personajes más votados por un usuario. Devuelve {Personaje, Long}.
     * Plan v2 §4.1 — sección "Tu Top 5" del perfil.
     */
    @Query("""
            SELECT v.personaje, COUNT(v)
            FROM Voto v
            WHERE v.usuario = :usuario
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC, v.personaje.id ASC
            """)
    List<Object[]> topPorUsuario(
            @Param("usuario") Usuario usuario,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Conteo agrupado por enfrentamiento dentro de un torneo. Evita N+1
     * cuando TorneoQueryService rellena `totalVotos` en cada match del
     * bracket: una sola query bulk en lugar de countByEnfrentamiento(e)
     * llamado 16 veces por torneo de 16 personajes.
     *
     * Devuelve Object[] {Long enfrentamientoId, Long count} para que el
     * service lo convierta a Map<Long, Long>.
     */
    @Query("""
            SELECT v.enfrentamiento.id, COUNT(v)
            FROM Voto v
            WHERE v.enfrentamiento.torneo.id = :torneoId
            GROUP BY v.enfrentamiento.id
            """)
    List<Object[]> contarVotosPorEnfrentamientoDeTorneo(@Param("torneoId") Long torneoId);

    /** Borra todos los votos cuyo personaje sea el id dado. */
    @Modifying
    @Query("DELETE FROM Voto v WHERE v.personaje.id = :personajeId")
    int deleteByPersonajeId(@Param("personajeId") Long personajeId);

    /**
     * Borra todos los votos cuyo enfrentamiento incluya al personaje dado
     * (como personaje1 o personaje2). Necesario antes de borrar los
     * enfrentamientos del personaje, porque Voto.enfrentamiento es FK.
     */
    @Modifying
    @Query("""
            DELETE FROM Voto v WHERE v.enfrentamiento.id IN (
              SELECT e.id FROM Enfrentamiento e
              WHERE e.personaje1.id = :personajeId OR e.personaje2.id = :personajeId
            )
            """)
    int deleteVotosEnEnfrentamientosDelPersonaje(@Param("personajeId") Long personajeId);
}
