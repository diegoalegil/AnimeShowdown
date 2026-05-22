-- Audit externo AS-003 (2026-05-22): los votos anónimos solo tenían
-- deduplicación a nivel aplicación (existsByEnfrentamientoAndAnonSessionId
-- en EnfrentamientoController). Dos requests concurrentes con el mismo
-- anon_session_id podían saltarse el check en su ventana antes del save
-- y registrar duplicados — alterando el ranking sin tener que rotar el
-- session id, solo abriendo dos tabs y enviando el voto al mismo tiempo.
--
-- UNIQUE constraint sobre (enfrentamiento_id, anon_session_id):
-- En SQL estándar, NULL != NULL para UNIQUE (Postgres "NULLS DISTINCT"
-- por defecto, H2 igual). Esto significa:
--   - Voto anónimo (usuario_id NULL, anon_session_id != NULL):
--     la combinación SÍ se constrainea — un solo voto por sesión y match.
--   - Voto registrado (usuario_id != NULL, anon_session_id NULL):
--     la combinación NO se constrainea (NULL != NULL) — funciona como
--     antes, sin afectar a usuarios logueados. La unicidad de votos
--     registrados ya la cubre uk_voto_enfrentamiento_usuario (V1).
--
-- Por qué simple UNIQUE en vez de partial index WHERE:
-- H2 (motor de tests con MODE=PostgreSQL) no soporta WHERE clauses en
-- CREATE UNIQUE INDEX. UNIQUE simple es portable a ambos motores y la
-- semántica deseada se cumple igualmente porque NULL != NULL para UNIQUE.
--
-- Sin riesgo de fallar al aplicar: si hubiera duplicados existentes,
-- Postgres aborta y el operador ve qué filas duplicadas hay. A día de
-- hoy el catálogo de votos anónimos no debería tener duplicados porque
-- el flujo solo se desplegó tras V28 con el check de aplicación activo.
ALTER TABLE votos
    ADD CONSTRAINT uk_voto_enfrentamiento_anon_session
    UNIQUE (enfrentamiento_id, anon_session_id);
