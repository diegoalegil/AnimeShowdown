-- Audit (2026-05-17): fk_pred_personaje (predicciones.personaje_predicho_id)
-- estaba sin ON DELETE en V9 → constraint RESTRICT. Cualquier DELETE FROM
-- personajes que afecte a un personaje con predicciones asociadas revienta
-- con FK violation. DataSeeder.borrarPersonajeConCascada lo emulaba a mano
-- (PrediccionRepository.deleteByPersonajePredichoId), pero solo cubre ese
-- caller — un eventual DELETE manual o desde otra ruta seguía rompiendo.
--
-- Migra a ON DELETE CASCADE: predicciones huérfanas se borran junto al
-- personaje. Una predicción a un personaje inexistente no tiene sentido
-- de negocio, coherente con la cascada que ya gestiona DataSeeder
-- programáticamente.
--
-- IF EXISTS por portabilidad H2/Postgres en tests.
ALTER TABLE predicciones DROP CONSTRAINT IF EXISTS fk_pred_personaje;
ALTER TABLE predicciones
    ADD CONSTRAINT fk_pred_personaje
    FOREIGN KEY (personaje_predicho_id) REFERENCES personajes (id) ON DELETE CASCADE;
