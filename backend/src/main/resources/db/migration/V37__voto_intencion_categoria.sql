-- ===========================================================================
-- V37__voto_intencion_categoria.sql
-- Ola 1 — Voto por intención → rankings por categoría (feature #15, flagship).
--
-- Al votar un duelo, el usuario puede elegir OPCIONALMENTE el "por qué"
-- (poder / diseño / carisma / mejor escrito / mejor villano / favorito), y
-- cada categoría genera su propio ranking → multiplica el contenido del
-- ranking sin tocar el motor de votos existente.
--
-- Decisiones del owner reflejadas en el schema:
--   * Lista CERRADA de 6 categorías. NO se materializa como CHECK en BBDD:
--     la validación vive en la capa Java (enum CategoriaVoto), así ampliar la
--     lista es una línea de código, jamás otra migración sobre una tabla con
--     millones de filas.
--   * Intención OPCIONAL → columna NULLABLE, sin DEFAULT. Los votos históricos
--     quedan categoria=NULL sin backfill: siguen contando 1:1 en el ranking
--     GLOBAL (sus GROUP BY no referencian esta columna) y simplemente no
--     aparecen en los rankings segmentados por categoría.
--   * "Mismo universo": un voto categorizado cuenta a la vez en el global y en
--     el de su categoría. NO tocamos uk_voto_enfrentamiento_usuario /
--     uk_voto_enfrentamiento_anon_session: sigue habiendo exactamente UNA fila
--     por (enfrentamiento, votante), así un voto lleva como mucho UNA categoría
--     y el global queda intacto por construcción.
--   * Guardamos el id de wire (kebab: 'poder', 'mejor-villano'…), no el name()
--     del enum, para que DB ↔ API ↔ URL ↔ frontend sean idénticos. VARCHAR(24)
--     cubre el id más largo con holgura.
--
-- Portable Postgres + H2 (MODE=PostgreSQL para tests, ddl-auto=validate):
-- ALTER TABLE ADD COLUMN y CREATE INDEX estándar funcionan en ambos motores.
-- ===========================================================================

ALTER TABLE votos
    ADD COLUMN categoria VARCHAR(24);

-- Índice para el hot path del ranking por categoría:
--   WHERE categoria = ? [AND fecha >= ?] GROUP BY personaje.
-- Igualdad-luego-rango es el orden correcto de columnas para un B-tree, así
-- sirve tanto al ranking all-time por categoría como al de ventana temporal.
-- Sin índice parcial (H2 no lo soporta igual que Postgres) — un índice normal
-- es portable y suficiente: la cardinalidad de categorías es muy baja (6).
CREATE INDEX idx_votos_categoria_fecha ON votos (categoria, fecha);
