package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.dto.RankingItem;
import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.dto.TopVoterItem;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;

public interface VotoRepository extends JpaRepository<Voto, Long> {

    /**
     * Ranking all-time por votos ponderados.
     *
     * <p>Se anade desempate por id ASC. Sin tiebreak,
     * dos personajes con el mismo COUNT salian en orden
     * arbitrario del dialecto SQL — el frontend mostraba a veces #4
     * "Naruto", a veces "Sasuke" para el mismo dataset. Con tiebreak
     * estable, el orden es determinista en H2, Postgres y queries
     * paginadas (sin riesgo de duplicar/saltar entries entre paginas).
     *
     * <p>Antes COUNT(v) ignoraba
     * el peso. EnfrentamientoController guarda voto.peso = 0.30 para
     * anónimos y 1.00 para registrados, pero el ranking contaba todos
     * por igual. La fase 1 castteaba SUM(peso) a Long y mezclaba ambas
     * métricas en el mismo campo, truncando 0.9 a 0. Ahora devolvemos
     * AMBOS valores en el DTO: votos (COUNT, físico para UI) y pesoVotos
     * (SUM, ponderado para ORDER BY y para que el frontend reordene la
     * caché live cuando llega un WS delta). Coalesce protege frente a
     * SUM nulo (grupo vacío, no debería pasar con GROUP BY pero defensivo).
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl,
                count(v),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v
            JOIN v.personaje p
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> obtenerRanking();

    /**
     * Ranking all-time paginado. Page para que la UI pueda
     * pedir top 50 o top 100 sin volcar todo el catálogo.
     *  + B2.1b: ponderado por peso para ORDER, físico para UI.
     */
    @Query(value = """
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl,
                count(v),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v
            JOIN v.personaje p
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """,
            countQuery = "SELECT COUNT(DISTINCT v.personaje.id) FROM Voto v")
    org.springframework.data.domain.Page<RankingItem> rankingAllTime(
            org.springframework.data.domain.Pageable pageable);

    /**
     * Ranking dentro de una ventana temporal (6 — top mensual,
     * trimestral, etc). desde es inclusivo. Aplica el mismo GROUP BY que
     * el all-time pero filtra por fecha del voto.
     *  + B2.1b: ponderado por peso para ORDER, físico para UI.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl,
                count(v),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v
            JOIN v.personaje p
            WHERE v.fecha >= :desde
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> rankingDesde(@Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Ranking "histórico": cuenta solo
     * votos EMITIDOS antes de la fecha dada. Sirve para comparar la
     * posición de hace N días con la posición actual y calcular el
     * movimiento de cada personaje.
     *  + B2.1b: ponderado por peso para ORDER, físico para UI.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl,
                count(v),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v
            JOIN v.personaje p
            WHERE v.fecha < :antesDe
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> rankingHasta(@Param("antesDe") java.time.LocalDateTime antesDe,
            org.springframework.data.domain.Pageable pageable);

    /** Total de votos de un personaje. */
    long countByPersonajeId(Long personajeId);

    /**
     * suma ponderada de votos del personaje.
     * Lo necesita el RankingDeltaEvent del WebSocket para publicar un valor
     * consistente con el ORDER del ranking REST. Antes el WS publicaba
     * COUNT físico y el frontend ordenaba su caché live por ese campo,
     * provocando que tras un voto anónimo (peso 0.3) la posición saltara
     * como si fuera 1.0 — desalineando el orden hasta el siguiente refetch.
     */
    @Query("""
            SELECT coalesce(sum(v.peso), 0)
            FROM Voto v
            WHERE v.personaje.id = :personajeId
            """)
    Double sumaPesoByPersonajeId(@Param("personajeId") Long personajeId);

    /**
     * Cuenta votos del personaje dentro del rango [desde, hasta) — desde
     * inclusivo, hasta exclusivo para que el caller pueda concatenar
     * periodos sin solape. Usado por VotosPeriodoService para calcular delta entre
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
     * Votos por día del personaje desde la fecha dada.
     * Devuelve {@code [fechaInicio-del-día, count]}.
     *
     * <p>Usamos CAST en vez de {@code FUNCTION('DATE', v.fecha)} porque esa
     * función delegaba al dialecto SQL. En H2 se traducía a
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
     * Ranking de personajes de un anime concreto. Filtramos
     * por nombre del anime (string del catálogo) — case-sensitive porque
     * los nombres en BBDD vienen consistentes del seeder.
     *  + B2.1b: ponderado por peso para ORDER, físico para UI.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl,
                count(v),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v
            JOIN v.personaje p
            WHERE p.anime = :anime
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
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

    /**
     * Ranking por intención de voto (feature #15): solo votos de esa categoría
     * (id de wire: 'poder', 'mejor-villano'…). Mismo shape y ponderación que el
     * ranking global — agrega {@code sum(v.peso)} para respetar el peso anónimo
     * (0.30) vs registrado (1.00) idénticamente al global. NO afecta al global:
     * es un filtro adicional, los votos sin categoría simplemente no entran.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl,
                count(v),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v
            JOIN v.personaje p
            WHERE v.categoria = :categoria
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> rankingPorCategoria(@Param("categoria") String categoria,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Ranking por intención dentro de una ventana temporal (combina categoría +
     * periodo, p.ej. "Top Poder este mes"). desde inclusivo.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl,
                count(v),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v
            JOIN v.personaje p
            WHERE v.categoria = :categoria AND v.fecha >= :desde
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.descripcion, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> rankingPorCategoriaDesde(@Param("categoria") String categoria,
            @Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Lista de categorías de intención con al menos un voto. Útil para no
     * pintar pestañas/chips vacíos en el sub-selector "Por intención" de
     * /ranking. Devuelve los ids de wire ('poder', 'mejor-villano'…).
     */
    @Query("""
            SELECT DISTINCT v.categoria
            FROM Voto v
            WHERE v.categoria IS NOT NULL
            ORDER BY v.categoria ASC
            """)
    List<String> categoriasConVotos();

    boolean existsByPersonajeAndUsuario(Personaje personaje, Usuario usuario);

    boolean existsByEnfrentamientoAndUsuario(Enfrentamiento enfrentamiento, Usuario usuario);

    boolean existsByEnfrentamientoAndAnonSessionId(Enfrentamiento enfrentamiento, String anonSessionId);

    /**
     * Voto del usuario registrado en un enfrentamiento (a lo sumo uno, por
     * uk_voto_enfrentamiento_usuario). Lo usa el PATCH set-once de intención
     * para localizar el voto a anotar.
     */
    java.util.Optional<Voto> findByEnfrentamientoAndUsuario(Enfrentamiento enfrentamiento, Usuario usuario);

    /**
     * Voto anónimo (por sesión) en un enfrentamiento (a lo sumo uno, por
     * uk_voto_enfrentamiento_anon_session). Lo usa el PATCH set-once de
     * intención para votantes invitados.
     */
    java.util.Optional<Voto> findByEnfrentamientoAndAnonSessionId(Enfrentamiento enfrentamiento, String anonSessionId);

    long countByAnonSessionId(String anonSessionId);

    /**
     * conteo de votos anónimos de una
     * sesión en una ventana temporal. Usado por
     * {@code AnonymousAbuseThrottleService} para aplicar umbrales 1h/24h
     * sin tener que crear una tabla nueva — la propia tabla de votos
     * tiene anon_session_id + fecha y los índices necesarios.
     */
    long countByAnonSessionIdAndFechaAfter(String anonSessionId, java.time.LocalDateTime desde);

    /**
     * conteo de votos anónimos por
     * hash IP+UA en una ventana temporal. Pega para abusos que rotan la
     * cookie firmada — varias sesiones distintas pero misma huella
     * técnica.
     */
    long countByAnonIpHashAndFechaAfter(String anonIpHash, java.time.LocalDateTime desde);

    List<Voto> findByAnonSessionIdAndUsuarioIsNullOrderByFechaAsc(String anonSessionId);

    /** Total de votos emitidos por un usuario. 2 (badges por umbral). */
    long countByUsuario(Usuario usuario);

    /**
     * Top voters all-time. Devuelve {Usuario, Long total}
     * ordenado descendente. Usado por GET /api/votos/top-voters?limit=10
     * para la página /leaderboards/voters.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.TopVoterItem(
                u.username,
                COALESCE(u.avatarUrl, ''),
                COUNT(v))
            FROM Voto v
            JOIN v.usuario u
            GROUP BY u.id, u.username, u.avatarUrl
            ORDER BY COUNT(v) DESC, u.id ASC
            """)
    List<TopVoterItem> topVoters(org.springframework.data.domain.Pageable pageable);

    /**
     * Top voters de los últimos N días (semanal/mensual). Mismo shape que
     * topVoters pero con WHERE fecha > :desde para ventana temporal.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.TopVoterItem(
                u.username,
                COALESCE(u.avatarUrl, ''),
                COUNT(v))
            FROM Voto v
            JOIN v.usuario u
            WHERE v.fecha > :desde
            GROUP BY u.id, u.username, u.avatarUrl
            ORDER BY COUNT(v) DESC, u.id ASC
            """)
    List<TopVoterItem> topVotersDesde(
            @Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    long countByEnfrentamientoAndPersonaje(Enfrentamiento enfrentamiento, Personaje personaje);

    /**
     * Feed público de los últimos N votos, con personaje + enfrentamiento +
     * usuario fetcheados eagerly para evitar N+1 al mapear a VotoFeedItem.
     *
     * <p>Consumido por SectionPulso en la home
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
     * 1.
     */
    org.springframework.data.domain.Page<Voto> findByUsuarioOrderByFechaDesc(
            Usuario usuario, org.springframework.data.domain.Pageable pageable);

    /**
     * Top N personajes más votados por un usuario. Devuelve {Personaje, Long}.
     * 1 — sección "Tu Top 5" del perfil.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.TopPersonajeItem(
                p.id, p.slug, p.nombre, p.imagenUrl, p.anime, COUNT(v))
            FROM Voto v
            JOIN v.personaje p
            WHERE v.usuario = :usuario
            GROUP BY p.id, p.slug, p.nombre, p.imagenUrl, p.anime
            ORDER BY COUNT(v) DESC, p.id ASC
            """)
    List<TopPersonajeItem> topPorUsuario(
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

    /**
     * Conteo agrupado por enfrentamiento y personaje para spectator live.
     * Devuelve Object[] {Long enfrentamientoId, Long personajeId, Long count}.
     */
    @Query("""
            SELECT v.enfrentamiento.id, v.personaje.id, COUNT(v)
            FROM Voto v
            WHERE v.enfrentamiento.torneo.id = :torneoId
            GROUP BY v.enfrentamiento.id, v.personaje.id
            """)
    List<Object[]> contarVotosPorEnfrentamientoYPersonajeDeTorneo(@Param("torneoId") Long torneoId);

    /**
     * Conteo de votos por torneo desde una fecha. Lo consume el listado
     * público para destacar torneos de comunidad con tracción reciente.
     */
    @Query("""
            SELECT v.enfrentamiento.torneo.id, COUNT(v)
            FROM Voto v
            WHERE v.fecha >= :desde
            GROUP BY v.enfrentamiento.torneo.id
            """)
    List<Object[]> contarVotosPorTorneoDesde(@Param("desde") java.time.LocalDateTime desde);

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
