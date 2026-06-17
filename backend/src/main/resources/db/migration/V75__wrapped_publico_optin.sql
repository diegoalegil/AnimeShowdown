-- ===========================================================================
-- V75__wrapped_publico_optin.sql
-- Opt-in del Wrapped PÚBLICO (oportunidad b): el usuario decide si su Wrapped
-- anual es compartible por URL. false por defecto = PRIVADO; solo se expone en
-- GET /api/wrapped/u/{username} cuando el dueño lo activa explícitamente
-- (gate del endpoint público; 404 si no es público, para no filtrar existencia).
-- Aditiva y portable Postgres + H2.
-- ===========================================================================

ALTER TABLE usuarios ADD COLUMN wrapped_publico BOOLEAN NOT NULL DEFAULT false;
