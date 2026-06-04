-- V70: permite sobres GRATIS (precio = 0).
--
-- El sobre de bienvenida (CartaService.reclamarSobreBienvenida) y los sobres
-- gratis persisten un SobreApertura con precio = 0, pero V44 modeló el CHECK
-- como (precio > 0). En Postgres real (y en H2+Flyway) el INSERT viola el
-- constraint → DataIntegrityViolationException → el GlobalExceptionHandler la
-- mapea a 409, de modo que NINGÚN usuario nuevo podía reclamar su sobre de
-- bienvenida (el gancho de activación). El bug era invisible en CI porque el
-- único test que lo tocaba (CartaServiceTest) mockea los repositorios y nunca
-- ejecutaba el INSERT real contra el schema.
--
-- precio = 0 es VÁLIDO para sobres gratis; los sobres de pago siguen siendo
-- > 0 por la lógica de negocio (precio del sobre configurado). Relajamos el
-- constraint a (precio >= 0).
ALTER TABLE sobre_apertura DROP CONSTRAINT IF EXISTS ck_sobre_apertura_precio;
ALTER TABLE sobre_apertura ADD CONSTRAINT ck_sobre_apertura_precio CHECK (precio >= 0);
