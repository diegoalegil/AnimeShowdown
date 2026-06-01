package com.diegoalegil.animeshowdown.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.PersonajeVotoScore;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeVotoScoreRepository;

@Service
public class PersonajeVotoScoreService {

    private static final double VOTO_NORMAL = 1.0d;
    private static final double VOTO_EMPATE = 0.5d;

    private final PersonajeVotoScoreRepository repository;

    public PersonajeVotoScoreService(PersonajeVotoScoreRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void registrar(Voto voto) {
        if (voto == null) {
            return;
        }
        if (!voto.isEmpate()) {
            incrementar(voto.getPersonaje(), VOTO_NORMAL);
            return;
        }
        Enfrentamiento enfrentamiento = voto.getEnfrentamiento();
        if (enfrentamiento == null) {
            incrementar(voto.getPersonaje(), VOTO_EMPATE);
            return;
        }
        incrementar(enfrentamiento.getPersonaje1(), VOTO_EMPATE);
        incrementar(enfrentamiento.getPersonaje2(), VOTO_EMPATE);
    }

    private void incrementar(Personaje personaje, double delta) {
        if (personaje == null || personaje.getId() == null) {
            return;
        }
        PersonajeVotoScore score = repository.findByPersonajeIdForUpdate(personaje.getId())
                .orElseGet(() -> new PersonajeVotoScore(personaje.getId()));
        score.incrementar(delta);
        repository.save(score);
    }
}
