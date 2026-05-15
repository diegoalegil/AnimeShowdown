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
 * Migraciones idempotentes de valores enum almacenados en BBDD.
 *
 * Por qué existe: cuando renombramos valores de un enum Java (por ejemplo
 * EstadoTorneo.BORRADOR → SCHEDULED), las filas guardadas con el nombre
 * viejo rompen al deserializar — JPA ve "BORRADOR" y no encuentra ese
 * valor en el enum nuevo. Hibernate explota con IllegalArgumentException
 * antes de que cualquier endpoint pueda atender una petición.
 *
 * Solución: ejecutar SQL nativo vía JdbcTemplate ANTES de cualquier acceso
 * JPA. JdbcTemplate no carga entidades — solo ve la columna como VARCHAR,
 * así que puede actualizar "BORRADOR" → "SCHEDULED" sin tropezar con el
 * enum Java.
 *
 * @Order(HIGHEST_PRECEDENCE) garantiza que corre antes que DataSeeder
 * (que no tiene @Order, va a Integer.MAX_VALUE por defecto).
 *
 * Cuando llegue Flyway (Plan v2 §2.7) este bean se borra y la migración
 * se mueve a un V{n}__rename_estado_torneo.sql versionado.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class EnumMigrations implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EnumMigrations.class);

    private final JdbcTemplate jdbcTemplate;

    public EnumMigrations(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        migrarEstadoTorneo();
        rellenarSlugsTorneos();
    }

    /**
     * Rellena `torneos.slug` para filas viejas sin slug (anteriores al
     * Plan v2 §1.1 commit 2). Fallback determinista `torneo-{id}` que
     * garantiza unicidad por PK. Para torneos nuevos el slug lo asigna
     * TorneoService.crear() a partir del nombre antes de persistir.
     *
     * El ALTER TABLE para añadir la columna lo hace Hibernate con
     * ddl-auto=update — esta migración solo rellena los huecos NULL.
     * Idempotente: si todos tienen slug, 0 filas tocadas.
     */
    private void rellenarSlugsTorneos() {
        try {
            int rellenados = jdbcTemplate.update(
                    "UPDATE torneos SET slug = 'torneo-' || id WHERE slug IS NULL");
            if (rellenados > 0) {
                log.info("EnumMigrations.slugTorneos: {} torneos sin slug rellenados con 'torneo-{{id}}'", rellenados);
            }
        } catch (DataAccessException e) {
            // Columna slug aún no creada por Hibernate, o tabla vacía: skip.
            log.debug("EnumMigrations.slugTorneos: columna slug aún no existe o no hay filas viejas", e);
        }
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
                log.info("EnumMigrations.estadoTorneo: {} filas migradas (BORRADOR→SCHEDULED:{}, ACTIVO→IN_PROGRESS:{}, FINALIZADO→FINISHED:{})",
                        total, borrador, activo, finalizado);
            }
        } catch (DataAccessException e) {
            // Primer arranque sin tabla aún, o columna estado no presente:
            // hibernate creará la tabla con ddl-auto=update justo después.
            log.debug("EnumMigrations.estadoTorneo: tabla torneos sin datos viejos o aún no existe", e);
        }
    }
}
