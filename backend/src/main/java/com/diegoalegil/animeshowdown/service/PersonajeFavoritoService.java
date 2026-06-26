package com.diegoalegil.animeshowdown.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.FavoritoItemDto;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PersonajeFavoritoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

import jakarta.persistence.EntityNotFoundException;

/**
 * Lógica de "Mi roster" — sigue/dejar de seguir personajes.
 *
 * <p>Decisiones:
 * <ul>
 *   <li>seguir es idempotente — si ya seguías, no se devuelve error
 *       (UX: el frontend no necesita conocer el estado previo).</li>
 *   <li>dejarDeSeguir también idempotente — si no estaba, no falla.</li>
 *   <li>El service nunca expone favoritos de otros usuarios. Listar es
 *       siempre "los míos"; chequear si sigo es "yo a X".</li>
 * </ul>
 */
@Service
public class PersonajeFavoritoService {

    private final PersonajeFavoritoRepository favoritoRepository;
    private final PersonajeRepository personajeRepository;

    public PersonajeFavoritoService(PersonajeFavoritoRepository favoritoRepository,
            PersonajeRepository personajeRepository) {
        this.favoritoRepository = favoritoRepository;
        this.personajeRepository = personajeRepository;
    }

    /** Roster del usuario. Vacío si aún no sigue a nadie. */
    @Transactional(readOnly = true)
    public List<FavoritoItemDto> listarMisFavoritos(Usuario usuario) {
        return favoritoRepository.findRosterByUsuario(usuario).stream()
                .map(FavoritoItemDto::from)
                .toList();
    }

    /**
     * Sigue al personaje. Idempotente — si ya seguía, no hace nada y
     * devuelve {@code false} (caller puede distinguir "ya seguía" de
     * "primera vez" si necesita un toast distinto).
     *
     * @return true si se creó la relación, false si ya existía.
     * @throws EntityNotFoundException si el slug no existe.
     */
    @Transactional
    public boolean seguir(Usuario usuario, String slug) {
        Personaje personaje = personajeBySlug(slug);
        // Insert atómico idempotente (ON CONFLICT DO NOTHING) en vez del mutex global
        // + existsBy + insert: la PK (usuario_id, personaje_id) arbitra la carrera.
        return favoritoRepository.insertarSiFalta(usuario.getId(), personaje.getId()) > 0;
    }

    /**
     * Deja de seguir. Idempotente — si no seguía, devuelve false sin
     * lanzar excepción.
     *
     * @return true si se borró una relación, false si no había nada.
     * @throws EntityNotFoundException si el slug no existe.
     */
    @Transactional
    public boolean dejarDeSeguir(Usuario usuario, String slug) {
        Personaje personaje = personajeBySlug(slug);
        // deleteByUsuarioAndPersonaje es idempotente (DELETE WHERE → 0/1): sin lock.
        int borradas = favoritoRepository.deleteByUsuarioAndPersonaje(usuario, personaje);
        return borradas > 0;
    }

    /** Chequea si el usuario sigue al personaje. 404 si el slug no existe. */
    @Transactional(readOnly = true)
    public boolean estaSiguiendo(Usuario usuario, String slug) {
        Personaje personaje = personajeBySlug(slug);
        return favoritoRepository.existsByUsuarioAndPersonaje(usuario, personaje);
    }

    private Personaje personajeBySlug(String slug) {
        return personajeRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Personaje no encontrado: " + slug));
    }
}
