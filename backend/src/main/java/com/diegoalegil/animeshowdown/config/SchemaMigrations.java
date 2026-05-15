package com.diegoalegil.animeshowdown.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Migraciones idempotentes de schema y datos antes de cualquier acceso JPA.
 *
 * Por qué existe: Hibernate con ddl-auto=update solo añade columnas/índices
 * (nunca renombra ni cambia constraints) y no toca datos. Cuando renombramos
 * un valor de enum, añadimos un campo NOT NULL a tabla con filas, o relajamos
 * una constraint, necesitamos SQL nativo. Este bean ejecuta esos cambios al
 * arrancar la app con JdbcTemplate, sin pasar por entidades JPA (porque las
 * entidades viejas tropezarían con los valores incompatibles).
 *
 * @Order(HIGHEST_PRECEDENCE) garantiza que corre antes que DataSeeder (que
 * no tiene @Order, va a Integer.MAX_VALUE por defecto). Cualquier query JPA
 * a las tablas afectadas ocurre después.
 *
 * Cuando llegue Flyway (Plan v2 §2.7) este bean se borra y todas estas
 * operaciones se mueven a archivos V{n}__{descripcion}.sql versionados.
 *
 * Historia (no borrar comentarios):
 *  - Commit 1: rename EstadoTorneo BORRADOR/ACTIVO/FINALIZADO → SCHEDULED/IN_PROGRESS/FINISHED.
 *  - Commit 2: rellena slug en torneos viejos.
 *  - Commit 3: drop NOT NULL de enfrentamientos.personaje1/2 (rondas futuras
 *              pueden tener slots vacíos), rellena ronda en filas viejas.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SchemaMigrations implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigrations.class);

    private final JdbcTemplate jdbcTemplate;

    public SchemaMigrations(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        migrarEstadoTorneo();
        rellenarSlugsTorneos();
        relajarNotNullPersonajesEnfrentamiento();
        rellenarRondaEnfrentamientos();
    }

    /**
     * Rename EstadoTorneo: BORRADOR → SCHEDULED, ACTIVO → IN_PROGRESS,
     * FINALIZADO → FINISHED. Idempotente: en el segundo arranque los UPDATE
     * afectan 0 filas y no se loguea nada.
     */
    private void migrarEstadoTorneo() {
        try {
            int borrador = jdbcTemplate.update(
                    "UPDATE torneos SET estado = 'SCHEDULED' WHERE estado = 'BORRADOR'");
            int activo = jdbcTemplate.update(
                    "UPDATE torneos SET estado = 'IN_PROGRESS' WHERE estado = 'ACTIVO'");
            int finalizado = jdbcTemplate.update(
                    "UPDATE torneos SET estado = 'FINISHED' WHERE estado = 'FINALIZADO'");
            int total = borrador + activo + finalizado;
            if (total > 0) {
                log.info("SchemaMigrations.estadoTorneo: {} filas migradas (BORRADOR→SCHEDULED:{}, ACTIVO→IN_PROGRESS:{}, FINALIZADO→FINISHED:{})",
                        total, borrador, activo, finalizado);
            }
        } catch (DataAccessException e) {
            log.debug("SchemaMigrations.estadoTorneo: tabla torneos sin datos viejos o aún no existe", e);
        }
    }

    /**
     * Rellena `torneos.slug` para filas viejas sin slug (anteriores al
     * Plan v2 §1.1 commit 2). Fallback determinista `torneo-{id}` que
     * garantiza unicidad por PK.
     */
    private void rellenarSlugsTorneos() {
        try {
            int rellenados = jdbcTemplate.update(
                    "UPDATE torneos SET slug = 'torneo-' || id WHERE slug IS NULL");
            if (rellenados > 0) {
                log.info("SchemaMigrations.slugTorneos: {} torneos sin slug rellenados con 'torneo-{{id}}'", rellenados);
            }
        } catch (DataAccessException e) {
            log.debug("SchemaMigrations.slugTorneos: columna slug aún no existe o no hay filas viejas", e);
        }
    }

    /**
     * Relaja la constraint NOT NULL en enfrentamientos.personaje1_id y
     * personaje2_id. Antes los matches solo se creaban con ambos personajes
     * conocidos (1ª ronda). Con el bracket precomputado (Plan v2 §1.1
     * commit 4), las rondas 2+ se crean con slots vacíos que se rellenan al
     * resolver la ronda anterior — necesitamos que la columna acepte NULL.
     *
     * Hibernate ddl-auto=update NO cambia constraints existentes, así que
     * la columna en Postgres sigue NOT NULL aunque el @Column Java diga
     * nullable=true. Lo arreglamos a mano con ALTER COLUMN DROP NOT NULL,
     * idempotente.
     */
    private void relajarNotNullPersonajesEnfrentamiento() {
        try {
            jdbcTemplate.execute("ALTER TABLE enfrentamientos ALTER COLUMN personaje1_id DROP NOT NULL");
            jdbcTemplate.execute("ALTER TABLE enfrentamientos ALTER COLUMN personaje2_id DROP NOT NULL");
            log.debug("SchemaMigrations.notNullEnfrentamientos: NOT NULL eliminado de personaje1_id y personaje2_id (idempotente)");
        } catch (DataAccessException e) {
            // Tabla aún no creada, o constraint ya estaba relajada en BBDD distinta:
            // ALTER ... DROP NOT NULL en Postgres es idempotente (no falla si ya está sin NOT NULL).
            log.debug("SchemaMigrations.notNullEnfrentamientos: tabla aún no existe", e);
        }
    }

    /**
     * Rellena enfrentamientos.ronda para filas viejas (commits previos al
     * bracket precomputado). Hibernate añade la columna con DEFAULT 1 pero
     * en Postgres con ddl-auto=update el DEFAULT solo aplica a INSERTs
     * nuevos, no rellena filas existentes — eso lo hacemos aquí.
     */
    private void rellenarRondaEnfrentamientos() {
        try {
            int rellenados = jdbcTemplate.update(
                    "UPDATE enfrentamientos SET ronda = 1 WHERE ronda IS NULL");
            if (rellenados > 0) {
                log.info("SchemaMigrations.rondaEnfrentamientos: {} enfrentamientos sin ronda rellenados con ronda=1", rellenados);
            }
        } catch (DataAccessException e) {
            log.debug("SchemaMigrations.rondaEnfrentamientos: columna ronda aún no existe o no hay filas viejas", e);
        }
    }
}
