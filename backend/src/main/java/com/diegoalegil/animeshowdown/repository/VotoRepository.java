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

    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(v.personaje, COUNT(v))
            FROM Voto v
            GROUP BY v.personaje
            ORDER BY COUNT(v) DESC
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
            ORDER BY COUNT(v) DESC
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
            ORDER BY COUNT(v) DESC
            """)
    List<RankingItem> rankingDesde(@Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

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
            ORDER BY COUNT(v) DESC
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
            ORDER BY COUNT(v) DESC
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
            ORDER BY COUNT(v) DESC
            """)
    List<Object[]> topVotersDesde(
            @Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    long countByEnfrentamientoAndPersonaje(Enfrentamiento enfrentamiento, Personaje personaje);

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
            ORDER BY COUNT(v) DESC
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
