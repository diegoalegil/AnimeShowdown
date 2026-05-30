-- Banner del perfil — cabecera visual del usuario en /perfil, /u/{username} y
-- en su OG de perfil. Imagen subida por el usuario (clona el pipeline del
-- avatar: data URI base64 o URL pública en columna TEXT, NO usa R2). Opcional
-- (NULL = sin banner explícito); en ese caso el frontend/OG hacen fallback al
-- arte del personaje favorito (regla de identidad: el banner nunca queda
-- genérico). TEXT para soportar data URIs base64 de hasta 2 MB, igual que
-- avatar_url.
--
-- Portable Postgres + H2 (MODE=PostgreSQL para tests). Nullable, sin default:
-- los usuarios existentes quedan sin banner hasta que lo configuren.
ALTER TABLE usuarios
    ADD COLUMN banner_url TEXT;
