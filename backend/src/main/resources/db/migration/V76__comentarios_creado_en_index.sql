-- Índice para la vista admin de comentarios sin filtro de estado.
--
-- ComentarioRepository.findAllByOrderByCreadoEnDesc() (ComentarioService al
-- listar admin con estado == null) ordena por creado_en DESC SIN WHERE. Los
-- índices de V21 (personaje_slug/estado/creado_en, autor_id/creado_en,
-- estado/creado_en) tienen creado_en como columna NO-líder, así que el planner
-- no los puede usar para un ORDER BY puro → full scan + sort en memoria por
-- cada página. Un índice con creado_en de líder permite index scan directo.
--
-- (Recordatorio: prod usa ddl-auto=validate; los índices solo existen vía
-- Flyway, no por las anotaciones @Index de la entidad.)
-- Portable Postgres + H2 (MODE=PostgreSQL para tests).
CREATE INDEX IF NOT EXISTS idx_comentarios_creado_en
    ON comentarios_personaje (creado_en DESC);
