INSERT INTO logros (codigo, nombre, descripcion, icono, rareza)
SELECT 'otaku_certificado',
       'Otaku certificado',
       'Completaste tres sesiones del test rapido del glosario.',
       'GraduationCap',
       3
WHERE NOT EXISTS (SELECT 1 FROM logros WHERE codigo = 'otaku_certificado');
