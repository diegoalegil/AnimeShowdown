CREATE TABLE social_operacion_lock (
    clave VARCHAR(80) PRIMARY KEY,
    descripcion VARCHAR(255) NOT NULL
);

INSERT INTO social_operacion_lock (clave, descripcion) VALUES
    ('personajes_favoritos', 'Serializa favoritos de personaje'),
    ('seguidores', 'Serializa relaciones de seguimiento'),
    ('push_subscription', 'Serializa suscripciones push por endpoint'),
    ('reacciones', 'Serializa toggles de reacciones');
