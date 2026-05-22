-- Fix schema mismatch introducido por V25: duelos_live_rondas.voto_jugador1
-- y voto_jugador2 se crearon como VARCHAR(1), pero la entidad
-- DueloLiveRonda los mapea con:
--     @Enumerated(EnumType.STRING)
--     @Column(name = "voto_jugador1", length = 1)
--     private DueloLiveChoice votoJugador1;
-- DueloLiveChoice define 3 valores: A, B y EMPATE. Aunque por lógica
-- de negocio solo A o B llegan a estas columnas (el servicio rechaza
-- EMPATE con BAD_REQUEST en /votar), Hibernate inspecciona el tipo del
-- campo y exige una columna capaz de almacenar el valor enum más largo,
-- que es 'EMPATE' (6 chars). Con length=1 + EnumType.STRING contra un
-- enum con valor de 6 chars, Hibernate falla la validación.
--
-- Solución: ampliar las columnas a VARCHAR(10) (margen razonable sobre
-- los 6 chars actuales) y subir el length=1 a length=10 en la entidad
-- (en commit aparte) para que el match con Hibernate sea exacto.
--
-- Esto se manifestaba solo contra Postgres real con ddl-auto=validate;
-- H2 con MODE=PostgreSQL es laxo con la validación de tipos enum y por
-- eso los tests pasaban pero el e2e con Postgres rompía.
--
-- VARCHAR(1) -> VARCHAR(10) es una operación segura: ampliación, sin
-- riesgo de truncar las filas existentes (que como mucho son 'A' o 'B').
-- Postgres admite la conversión implícita en este caso, no hace falta
-- USING porque ambos son VARCHAR.

ALTER TABLE duelos_live_rondas
    ALTER COLUMN voto_jugador1 TYPE VARCHAR(10);

ALTER TABLE duelos_live_rondas
    ALTER COLUMN voto_jugador2 TYPE VARCHAR(10);
