ALTER TABLE fantasy_equipo_item
    DROP CONSTRAINT IF EXISTS fk_fantasy_item_personaje;

ALTER TABLE fantasy_equipo_item
    ADD CONSTRAINT fk_fantasy_item_personaje
    FOREIGN KEY (personaje_id) REFERENCES personajes(id) ON DELETE CASCADE;
