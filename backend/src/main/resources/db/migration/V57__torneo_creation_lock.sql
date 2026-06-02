CREATE TABLE torneo_operacion_lock (
    clave VARCHAR(80) PRIMARY KEY,
    descripcion VARCHAR(255) NOT NULL
);

INSERT INTO torneo_operacion_lock (clave, descripcion)
VALUES ('torneo_creation', 'Serializa creacion de torneos y slugs');
