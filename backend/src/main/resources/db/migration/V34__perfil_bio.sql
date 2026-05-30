-- Tanda 3 (social/comunidad B7) §1a — bio editable del perfil. Texto libre
-- corto que el usuario muestra en /u/{username} y en su OG de perfil. Opcional
-- (NULL = sin bio), límite de 240 caracteres alineado con la validación del
-- backend (PerfilService.sanitizarBio). Sin HTML: el backend la guarda como
-- texto plano (strip de etiquetas) antes de persistir.
--
-- Portable Postgres + H2 (MODE=PostgreSQL para tests). Nullable, sin default:
-- los usuarios existentes quedan sin bio hasta que la editen.
ALTER TABLE usuarios
    ADD COLUMN bio VARCHAR(240);
