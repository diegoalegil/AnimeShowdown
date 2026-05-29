-- V-8 onboarding OAuth: marca si el usuario ya completó (o saltó) el paso de
-- onboarding post-login —elegir username y avatar—. Los usuarios creados por
-- OAuth nacen con username autogenerado y onboarding_completado = FALSE, así
-- que ven el modal una vez; los registros por formulario nacen en TRUE porque
-- ya eligieron su username. El frontend lee needsOnboarding (= NOT
-- onboarding_completado) desde /me para decidir si mostrar el modal.
ALTER TABLE usuarios
    ADD COLUMN onboarding_completado BOOLEAN NOT NULL DEFAULT FALSE;

-- Usuarios existentes ya tienen un username asentado: no les mostramos el
-- onboarding retroactivamente.
UPDATE usuarios SET onboarding_completado = TRUE;
