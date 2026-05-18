-- Corrige el seed live de "MHA: Héroes vs Villanos": el bracket usaba
-- slug "himiko", que en el catálogo actual es Himiko de Btooom!, no
-- Himiko Toga de My Hero Academia. Solo se repara si el match sigue sin
-- votos ni ganador, para no pisar actividad real.

UPDATE enfrentamientos
SET personaje1_id = (SELECT p.id FROM personajes p WHERE p.slug = 'toga')
WHERE id IN (
    SELECT e.id
    FROM enfrentamientos e
    JOIN torneos t ON t.id = e.torneo_id
    JOIN personajes p1 ON p1.id = e.personaje1_id
    JOIN personajes p2 ON p2.id = e.personaje2_id
    WHERE t.slug = 'mha-heroes-vs-villains'
      AND e.ronda = 1
      AND p1.slug = 'himiko'
      AND p2.slug = 'bakugo'
      AND e.ganador_id IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM votos v WHERE v.enfrentamiento_id = e.id
      )
)
AND EXISTS (SELECT 1 FROM personajes p WHERE p.slug = 'toga');
