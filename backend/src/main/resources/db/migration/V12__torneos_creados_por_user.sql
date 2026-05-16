-- ===========================================================================
-- V12__torneos_creados_por_user.sql
-- Plan v2 §4.9 — Torneos creados por usuarios.
--
-- Hasta ahora torneos los creaba solo ADMIN — visibles inmediatamente.
-- A partir de aquí, cualquier cuenta verificada (email confirmado) puede
-- crear torneos, pero entran en cola de revisión hasta que un admin los
-- apruebe. Los torneos legacy (creados por admin antes de esta migración)
-- quedan marcados con estado_revision = 'NO_APLICA' para que el filtro
-- "torneos visibles" pase a transparentar tanto los aprobados como los
-- legacy sin tocar 50 filas a mano.
--
-- Columnas añadidas:
--   created_by_user_id  — FK al user creador, NULL para los legacy admin.
--                          ON DELETE SET NULL para no perder el torneo si
--                          el user se da de baja.
--   estado_revision     — enum PostgreSQL stringificado (NO_APLICA / PENDIENTE
--                          / APROBADO / RECHAZADO). 'NO_APLICA' para legacy
--                          admin (saltan revisión).
--   motivo_rechazo      — TEXT NULL, solo poblado cuando admin rechaza.
--   visibilidad         — PUBLICO (default) / PRIVADO (preparado para Plan
--                          v2 §4.9.f, no expuesto en API todavía).
-- ===========================================================================

ALTER TABLE torneos
    ADD COLUMN created_by_user_id BIGINT;

ALTER TABLE torneos
    ADD COLUMN estado_revision VARCHAR(20);

ALTER TABLE torneos
    ADD COLUMN motivo_rechazo TEXT;

ALTER TABLE torneos
    ADD COLUMN visibilidad VARCHAR(10) NOT NULL DEFAULT 'PUBLICO';

ALTER TABLE torneos
    ADD COLUMN fecha_revisado TIMESTAMP;

-- FK soft: si el user creador se borra dejamos el torneo huérfano pero
-- visible (mejor que cascade-delete y perder un bracket público).
ALTER TABLE torneos
    ADD CONSTRAINT fk_torneo_creador
    FOREIGN KEY (created_by_user_id) REFERENCES usuarios (id) ON DELETE SET NULL;

-- Backfill: torneos viejos sin creador → NO_APLICA (creados directamente
-- por admin antes de tener el flujo de revisión). Los NUEVOS entrarán con
-- PENDIENTE desde el service.
UPDATE torneos SET estado_revision = 'NO_APLICA' WHERE estado_revision IS NULL;

ALTER TABLE torneos
    ALTER COLUMN estado_revision SET NOT NULL;

-- Index hot path: la cola admin de pendientes filtra por estado_revision.
-- Pocos torneos pendientes a la vez (decenas), pero queremos el seek
-- directo en lugar de scan completo.
CREATE INDEX idx_torneos_estado_revision ON torneos (estado_revision);

-- Index para "mis torneos creados" en perfil propio — query por user.
CREATE INDEX idx_torneos_creador ON torneos (created_by_user_id);
