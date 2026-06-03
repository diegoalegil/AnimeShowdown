-- ELO SEMILLA investigado + género, para que el ranking no esté plano a 1500.
--
-- Hoy la "ELO base" = 1500 + votos, así que a 0 votos TODOS valen 1500 y el
-- ranking nace muerto. Estas columnas guardan una semilla por personaje
-- derivada de su popularidad real (favourites de AniList/MAL) + un ajuste de
-- diversidad (+15% a personajes femeninos), de modo que el catálogo tenga
-- diferenciación desde el día 0 y los votos sigan moviendo el ELO encima.
--
-- 100% ADITIVO y nullable: cero rewrite, cero backfill bloqueante. Mientras
-- estas columnas estén NULL / 1500, la app se comporta byte-idéntica a hoy
-- (fallback explícito). El seeding (servicio admin idempotente) las rellena
-- después; las que no matcheen quedan NULL → fallback 1500, sin romper nada.
--
-- Sin índices nuevos a propósito: `personajes` (~1086) y `voto_personaje_stats`
-- son tablas pequeñas; el seeding filtra por `elo_semilla IS NULL` (batch admin,
-- raro) y el ranking ordena por (elo_semilla + peso_votos) sobre ~1086 filas
-- (sort en memoria, sub-ms). Un índice aquí sería peso muerto.

ALTER TABLE personajes ADD COLUMN genero VARCHAR(16);              -- 'F','M','O', NULL = sin dato
ALTER TABLE personajes ADD COLUMN elo_semilla INTEGER;            -- NULL = sin semilla → fallback 1500
ALTER TABLE personajes ADD COLUMN popularidad_fuente INTEGER;     -- favourites crudos (auditar/recalcular)

-- Semilla materializada en la tabla que YA alimenta el ranking público
-- (RankingMaterializadoService ordena por esta tabla). DEFAULT 1500 NOT NULL
-- para que las filas creadas por el listener de voto nunca rompan el ORDER BY.
ALTER TABLE voto_personaje_stats ADD COLUMN elo_semilla INTEGER NOT NULL DEFAULT 1500;
