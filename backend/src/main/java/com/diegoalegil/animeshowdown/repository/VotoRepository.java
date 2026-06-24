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
     * Advisory lock de transacción (Postgres) por SESIÓN anónima. Se libera al
     * cerrar la tx, así que serializa los votos concurrentes de una MISMA
     * sesión: el check del tope ANON_VOTE_LIMIT + el save quedan atómicos. Sin
     * él, N votos simultáneos sobre matches distintos leerían count<tope a la
     * vez y todos insertarían (la UNIQUE (enfrentamiento, anon_session) de V30
     * solo frena el doble voto al MISMO match, no el total). Sesiones distintas
     * no contienden. El SELECT 1 envuelto da una fila escalar mapeable —
     * pg_advisory_xact_lock devuelve void. SOLO Postgres: el caller lo gatea por
     * dialecto (en H2 de tests no existe la función).
     */
    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(:clave))) AS _lock",
            nativeQuery = true)
    Integer lockSesionAnonima(@Param("clave") String clave);

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
     * AMBOS valores en el DTO: votos (score visible para UI) y pesoVotos
     * (SUM, ponderado para ORDER BY y para que el frontend reordene la
     * caché live cuando llega un WS delta). Coalesce protege frente a
     * SUM nulo (grupo vacío, no debería pasar con GROUP BY pero defensivo).
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.imagenUrl,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> obtenerRanking();

    /**
     * Ranking all-time paginado. Page para que la UI pueda
     * pedir top 50 o top 100 sin volcar todo el catálogo.
     *  + B2.1b: ponderado por peso para ORDER, score visible para UI.
     */
    @Query(value = """
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.imagenUrl,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """,
            countQuery = """
                    SELECT COUNT(DISTINCT p.id)
                    FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
                    WHERE (
                        (v.empate = false AND p.id = v.personaje.id)
                        OR (v.empate = true AND e IS NOT NULL
                            AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
                    )
                    """)
    org.springframework.data.domain.Page<RankingItem> rankingAllTime(
            org.springframework.data.domain.Pageable pageable);

    /**
     * Ranking dentro de una ventana temporal (6 — top mensual,
     * trimestral, etc). desde es inclusivo. Aplica el mismo GROUP BY que
     * el all-time pero filtra por fecha del voto.
     *  + B2.1b: ponderado por peso para ORDER, score visible para UI.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.imagenUrl,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND v.fecha >= :desde
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> rankingDesde(@Param("desde") java.time.LocalDateTime desde,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Ranking "histórico": cuenta solo
     * votos EMITIDOS antes de la fecha dada. Sirve para comparar la
     * posición de hace N días con la posición actual y calcular el
     * movimiento de cada personaje.
     *  + B2.1b: ponderado por peso para ORDER, score visible para UI.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.imagenUrl,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND v.fecha < :antesDe
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
            ORDER BY sum(v.peso) DESC, p.id ASC
            """)
    List<RankingItem> rankingHasta(@Param("antesDe") java.time.LocalDateTime antesDe,
            org.springframework.data.domain.Pageable pageable);

    /** Total de votos-score de un personaje: normal=1, empate=0.5 por lado. */
    @Query("""
            SELECT cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double)
            FROM Voto v LEFT JOIN v.enfrentamiento e
            WHERE (v.empate = false AND v.personaje.id = :personajeId)
               OR (v.empate = true AND e IS NOT NULL
                   AND (e.personaje1.id = :personajeId
                        OR e.personaje2.id = :personajeId))
            """)
    double countByPersonajeId(@Param("personajeId") Long personajeId);

    /**
     * Batch del score visible para decisiones PvP live. Evita dos agregados
     * globales por ronda cuando solo necesitamos comparar A contra B.
     */
    @Query("""
            SELECT p.id, cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double)
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND p.id IN :personajeIds
            GROUP BY p.id
            """)
    List<Object[]> countByPersonajeIds(@Param("personajeIds") java.util.Collection<Long> personajeIds);

    /** Conteo físico de votos normales; excluye empate neutral (no mueve ELO). */
    @Query("""
            SELECT COUNT(v)
            FROM Voto v
            WHERE v.empate = false
              AND v.personaje.id = :personajeId
            """)
    long countNormalByPersonajeId(@Param("personajeId") Long personajeId);

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
            FROM Voto v LEFT JOIN v.enfrentamiento e
            WHERE (v.empate = false AND v.personaje.id = :personajeId)
               OR (v.empate = true AND e IS NOT NULL
                   AND (e.personaje1.id = :personajeId
                        OR e.personaje2.id = :personajeId))
            """)
    Double sumaPesoByPersonajeId(@Param("personajeId") Long personajeId);

    /**
     * Cuenta votos del personaje dentro del rango [desde, hasta) — desde
     * inclusivo, hasta exclusivo para que el caller pueda concatenar
     * periodos sin solape. Usado por VotosPeriodoService para calcular delta entre
     * periodo actual y anterior.
     */
    @Query("""
            SELECT cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double)
            FROM Voto v LEFT JOIN v.enfrentamiento e
            WHERE v.fecha >= :desde
              AND v.fecha < :hasta
              AND (
                  (v.empate = false AND v.personaje.id = :personajeId)
                  OR (v.empate = true AND e IS NOT NULL
                      AND (e.personaje1.id = :personajeId
                           OR e.personaje2.id = :personajeId))
              )
            """)
    double countByPersonajeIdInRange(
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
            SELECT p.id, cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double)
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND p.id IN :personajeIds
              AND v.fecha >= :desde
              AND v.fecha < :hasta
            GROUP BY p.id
            """)
    List<Object[]> countByPersonajeIdsInRange(
            @Param("personajeIds") java.util.Collection<Long> personajeIds,
            @Param("desde") java.time.LocalDateTime desde,
            @Param("hasta") java.time.LocalDateTime hasta);

    /**
     * Mapa ligero de {@code personajeId → score} para todos los personajes
     * que tienen al menos un voto. Devuelve {@code [Long, Double]} (Object[]
     * 2-elementos) para evitar construir entidades RankItem a nivel repo —
     * el caller (RecomendacionService) solo necesita el score visible.
     *
     * <p>Antes el caller hacía {@code votoRepository.obtenerRanking()}
     * (full ranking con p.descripcion, p.slug, p.nombre, p.anime, p.imagenUrl,
     * pesoVotos) y luego {@code personajeRepository.findAll()} para filtrar/
     * ordenar en Java. Ahora usamos esta proyección directa.
     */
    @Query("""
            SELECT p.id, cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double)
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
            GROUP BY p.id
            """)
    List<Object[]> votosPorPersonajes();

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
              AND v.empate = false
            GROUP BY CAST(v.fecha AS java.time.LocalDate)
            ORDER BY CAST(v.fecha AS java.time.LocalDate) ASC
            """)
    List<Object[]> votosPorDiaDesde(@Param("personajeId") Long personajeId,
            @Param("desde") java.time.LocalDateTime desde);

    /**
     * Ranking de personajes de un anime concreto. Filtramos
     * por nombre del anime (string del catálogo) — case-sensitive porque
     * los nombres en BBDD vienen consistentes del seeder.
     *  + B2.1b: ponderado por peso para ORDER, score visible para UI.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.RankingItem(
                p.id, p.slug, p.nombre, p.anime, p.imagenUrl,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND p.anime = :anime
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
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
            SELECT DISTINCT p.anime
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
            ORDER BY p.anime ASC
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
                p.id, p.slug, p.nombre, p.anime, p.imagenUrl,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND v.categoria = :categoria
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
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
                p.id, p.slug, p.nombre, p.anime, p.imagenUrl,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double),
                cast(coalesce(sum(v.peso), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND v.categoria = :categoria AND v.fecha >= :desde
            GROUP BY p.id, p.slug, p.nombre, p.anime, p.imagenUrl
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

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Voto v
            SET v.categoria = :categoria
            WHERE v.enfrentamiento = :enfrentamiento
              AND v.usuario = :usuario
              AND v.categoria IS NULL
            """)
    int fijarCategoriaRegistradoSiPendiente(
            @Param("enfrentamiento") Enfrentamiento enfrentamiento,
            @Param("usuario") Usuario usuario,
            @Param("categoria") String categoria);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Voto v
            SET v.categoria = :categoria
            WHERE v.enfrentamiento = :enfrentamiento
              AND v.usuario IS NULL
              AND v.anonSessionId = :anonSessionId
              AND v.categoria IS NULL
            """)
    int fijarCategoriaAnonimaSiPendiente(
            @Param("enfrentamiento") Enfrentamiento enfrentamiento,
            @Param("anonSessionId") String anonSessionId,
            @Param("categoria") String categoria);

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
     * Score de un personaje dentro de un match. Voto normal=1; empate=0.5 para
     * cada participante. Es la métrica que decide bracket y UI post-voto.
     */
    @Query("""
            SELECT cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double)
            FROM Voto v
            WHERE v.enfrentamiento = :enfrentamiento
              AND (
                  (v.empate = false AND v.personaje = :personaje)
                  OR (v.empate = true AND (v.enfrentamiento.personaje1 = :personaje
                                           OR v.enfrentamiento.personaje2 = :personaje))
              )
            """)
    double scoreByEnfrentamientoAndPersonaje(
            @Param("enfrentamiento") Enfrentamiento enfrentamiento,
            @Param("personaje") Personaje personaje);

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
            LEFT JOIN FETCH e.torneo
            ORDER BY v.fecha DESC
            """)
    List<Voto> findRecentesParaFeed(org.springframework.data.domain.Pageable pageable);

    /**
     * Historial de votos del usuario, ordenados por fecha desc (más recientes
     * primero). JOIN FETCH en personajes + torneo del enfrentamiento para
     * evitar N+1: Enfrentamiento.torneo es @ManyToOne EAGER, así que sin
     * fetcharlo Hibernate emitía un SELECT por cada torneo distinto al que el
     * usuario votó (PerfilService.actividadReciente lee torneoId/slug/nombre).
     */
    @Query("""
            select v from Voto v
            join fetch v.personaje
            left join fetch v.enfrentamiento enf
            left join fetch enf.personaje1
            left join fetch enf.personaje2
            left join fetch enf.torneo
            where v.usuario = :usuario
            order by v.fecha desc
            """)
    org.springframework.data.domain.Page<Voto> findByUsuarioOrderByFechaDesc(
            Usuario usuario, org.springframework.data.domain.Pageable pageable);

    /**
     * Top N personajes más votados por un usuario. Devuelve {Personaje, Long}.
     * 1 — sección "Tu Top 5" del perfil.
     */
    @Query("""
            SELECT new com.diegoalegil.animeshowdown.dto.TopPersonajeItem(
                p.id, p.slug, p.nombre, p.imagenUrl, p.anime,
                cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double))
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND v.usuario = :usuario
            GROUP BY p.id, p.slug, p.nombre, p.imagenUrl, p.anime
            ORDER BY sum(case when v.empate = true then 0.5 else 1.0 end) DESC, p.id ASC
            """)
    List<TopPersonajeItem> topPorUsuario(
            @Param("usuario") Usuario usuario,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Fechas-calendario DISTINTAS en las que el usuario votó, ascendentes. La
     * consume {@code WrappedService} para calcular la racha más larga de días
     * consecutivos votando (la lógica de racha vive en un helper puro y testeable,
     * aquí solo entregamos las fechas reales).
     *
     * <p>Usamos {@code CAST(v.fecha AS java.time.LocalDate)} — la misma sintaxis
     * estándar JPA 3.0+ / Hibernate 6 que {@link #votosPorDiaDesde} — porque
     * ambos dialectos configurados (Postgres en prod, H2 en MODE=PostgreSQL en
     * tests) la resuelven correctamente, a diferencia de {@code FUNCTION('DATE')}.
     */
    @Query("""
            SELECT DISTINCT CAST(v.fecha AS java.time.LocalDate)
            FROM Voto v
            WHERE v.usuario = :usuario
            ORDER BY CAST(v.fecha AS java.time.LocalDate) ASC
            """)
    List<java.time.LocalDate> fechasDistintasDeVoto(@Param("usuario") Usuario usuario);

    /**
     * Conteo agrupado por enfrentamiento dentro de un torneo. Evita N+1
     * cuando TorneoQueryService rellena `totalVotos` en cada match del
     * bracket: una sola query bulk en lugar de countByEnfrentamiento(e)
     * llamado 16 veces por torneo de 16 personajes.
     *
     * Devuelve Object[] {Long enfrentamientoId, Double count} para que el
     * service lo convierta a Map<Long, Double>.
     */
    @Query("""
            SELECT v.enfrentamiento.id, cast(COUNT(v) as double)
            FROM Voto v
            WHERE v.enfrentamiento.torneo.id = :torneoId
            GROUP BY v.enfrentamiento.id
            """)
    List<Object[]> contarVotosPorEnfrentamientoDeTorneo(@Param("torneoId") Long torneoId);

    /**
     * Conteo agrupado por enfrentamiento y personaje para spectator live.
     * Devuelve Object[] {Long enfrentamientoId, Long personajeId, Double score}.
     */
    @Query("""
            SELECT v.enfrentamiento.id, p.id,
                   cast(coalesce(sum(case when v.empate = true then 0.5 else 1.0 end), 0) as double)
            FROM Voto v LEFT JOIN v.enfrentamiento e, Personaje p
            WHERE (
                (v.empate = false AND p.id = v.personaje.id)
                OR (v.empate = true AND e IS NOT NULL
                    AND (p.id = e.personaje1.id OR p.id = e.personaje2.id))
            )
              AND v.enfrentamiento.torneo.id = :torneoId
            GROUP BY v.enfrentamiento.id, p.id
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
