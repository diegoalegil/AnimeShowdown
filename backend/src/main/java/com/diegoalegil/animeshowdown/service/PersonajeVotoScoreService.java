package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;

@Service
public class PersonajeVotoScoreService {

    private static final Logger log = LoggerFactory.getLogger(PersonajeVotoScoreService.class);
    private static final double VOTO_NORMAL = 1.0d;
    private static final double VOTO_EMPATE = 0.5d;

    private final PersonajeVotoScoreRepository repository;

    public PersonajeVotoScoreService(PersonajeVotoScoreRepository repository) {
        this.repository = repository;
    }

    /**
     * Materializa el score de un voto. Se invoca desde {@link VotoScoreListener}
     * en AFTER_COMMIT (async), fuera de la transacción del POST /votar.
     *
     * <p>El incremento es ATÓMICO ({@code UPDATE ... SET votos_score =
     * votos_score + :delta}), sin {@code SELECT ... FOR UPDATE}: no retiene el
     * lock de la fila a través de la petición y converge sin lost-update bajo
     * votos concurrentes al mismo personaje. Idempotente por voto (un evento por
     * voto). En empate incrementa medio punto a cada participante.
     */
    @Transactional
    public void registrar(boolean empate, Long votoPersonajeId, Long personaje1Id, Long personaje2Id) {
        if (!empate) {
            incrementar(votoPersonajeId, VOTO_NORMAL);
            return;
        }
        if (personaje1Id == null || personaje2Id == null) {
            incrementar(votoPersonajeId, VOTO_EMPATE);
            return;
        }
        incrementar(personaje1Id, VOTO_EMPATE);
        incrementar(personaje2Id, VOTO_EMPATE);
    }

    private void incrementar(Long personajeId, double delta) {
        if (personajeId == null) {
            return;
        }
        if (repository.incrementarScore(personajeId, delta) == 0) {
            // Fila aún no materializada (personaje añadido tras el backfill V53):
            // la creamos de forma idempotente (INSERT ... ON CONFLICT DO NOTHING,
            // sin excepción que envenene la transacción) y reintentamos el
            // incremento atómico, que ahora sí encuentra la fila.
            repository.insertarSiFalta(personajeId);
            if (repository.incrementarScore(personajeId, delta) == 0) {
                // El 2º intento tampoco encontró la fila (insert no aplicó o una
                // carrera la quitó): antes el delta se perdía en SILENCIO. Lo
                // dejamos visible para no enmascarar un drift del score.
                log.warn("Score no materializado para personaje {}: la fila sigue ausente "
                        + "tras insertarSiFalta; se pierde delta={}", personajeId, delta);
            }
        }
    }
}
