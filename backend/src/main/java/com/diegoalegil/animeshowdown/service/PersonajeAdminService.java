package com.diegoalegil.animeshowdown.service;

import java.util.List;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.PersonajeActualizarRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeCrearRequest;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.FantasyEquipoItemRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

import jakarta.persistence.EntityNotFoundException;

/**
 * Escritura administrativa del catálogo de personajes (crear / actualizar /
 * eliminar / alta en lote). Extraído de {@code PersonajeController} para que el
 * controller quede solo con la capa HTTP y la lógica de escritura — junto a su
 * invalidación de cachés e índice de búsqueda — viva en un único sitio testeable.
 *
 * <p>Las anotaciones {@code @CacheEvict} se aplican aquí (bean proxiado): el
 * controller llama a estos métodos como bean externo, así que la evicción ocurre
 * exactamente igual que cuando vivía en el controller. Cada escritura invalida
 * además el índice de búsqueda en memoria.
 */
@Service
public class PersonajeAdminService {

    private final PersonajeRepository personajeRepository;
    private final PersonajeBusquedaService personajeBusquedaService;
    private final FantasyEquipoItemRepository fantasyEquipoItemRepository;

    public PersonajeAdminService(PersonajeRepository personajeRepository,
            PersonajeBusquedaService personajeBusquedaService,
            FantasyEquipoItemRepository fantasyEquipoItemRepository) {
        this.personajeRepository = personajeRepository;
        this.personajeBusquedaService = personajeBusquedaService;
        this.fantasyEquipoItemRepository = fantasyEquipoItemRepository;
    }

    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-catalogo", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true),
            // Derivadas por slug: una edición/borrado de personaje debe refrescar
            // también su OG, matchups, votos por periodo e historial de ELO
            // (auditoría 2; allEntries porque las escrituras de admin son raras).
            @CacheEvict(value = "og-personaje", allEntries = true),
            @CacheEvict(value = "personaje-matchups", allEntries = true),
            @CacheEvict(value = "personaje-votos-periodo", allEntries = true),
            @CacheEvict(value = "personaje-elo-history", allEntries = true)
    })
    public Personaje crear(PersonajeCrearRequest request) {
        Personaje p = new Personaje(
                request.slug(),
                request.nombre(),
                request.anime(),
                request.descripcion(),
                request.imagenUrl());
        Personaje guardado = personajeRepository.save(p);
        personajeBusquedaService.invalidateIndex();
        return guardado;
    }

    /**
     * Borra el personaje. Devuelve {@code false} si no existe (el controller lo
     * traduce a 404) y {@code true} si lo eliminó.
     */
    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-catalogo", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true),
            // Derivadas por slug: una edición/borrado de personaje debe refrescar
            // también su OG, matchups, votos por periodo e historial de ELO
            // (auditoría 2; allEntries porque las escrituras de admin son raras).
            @CacheEvict(value = "og-personaje", allEntries = true),
            @CacheEvict(value = "personaje-matchups", allEntries = true),
            @CacheEvict(value = "personaje-votos-periodo", allEntries = true),
            @CacheEvict(value = "personaje-elo-history", allEntries = true)
    })
    public boolean eliminar(Long id) {
        if (!personajeRepository.existsById(id)) {
            return false;
        }
        // No borrar si el personaje está fichado en algún equipo fantasy: la FK
        // fantasy_equipo_item.personaje_id es ON DELETE CASCADE (V52), así que el
        // borrado encogería los equipos en SILENCIO —incluidos los de semanas vivas/
        // bloqueadas— corrompiendo la puntuación. Se rechaza con 409 para que el admin
        // saque al personaje de los equipos (o cierre la semana) antes; nunca destruye
        // equipos sin querer.
        if (fantasyEquipoItemRepository.existsByPersonajeId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede borrar: el personaje está fichado en equipos fantasy. "
                            + "Sácalo de los equipos o cierra la semana antes de borrarlo.");
        }
        personajeRepository.deleteById(id);
        personajeBusquedaService.invalidateIndex();
        return true;
    }

    /**
     * Actualización parcial: los campos null se ignoran (preservan el valor
     * previo). Lanza {@link EntityNotFoundException} si el id no existe.
     */
    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-catalogo", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true),
            // Derivadas por slug: una edición/borrado de personaje debe refrescar
            // también su OG, matchups, votos por periodo e historial de ELO
            // (auditoría 2; allEntries porque las escrituras de admin son raras).
            @CacheEvict(value = "og-personaje", allEntries = true),
            @CacheEvict(value = "personaje-matchups", allEntries = true),
            @CacheEvict(value = "personaje-votos-periodo", allEntries = true),
            @CacheEvict(value = "personaje-elo-history", allEntries = true)
    })
    public Personaje actualizar(Long id, PersonajeActualizarRequest datos) {
        Personaje p = personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id));
        if (datos.slug() != null) p.setSlug(datos.slug());
        if (datos.nombre() != null) p.setNombre(datos.nombre());
        if (datos.anime() != null) p.setAnime(datos.anime());
        if (datos.descripcion() != null) p.setDescripcion(datos.descripcion());
        if (datos.imagenUrl() != null) p.setImagenUrl(datos.imagenUrl());
        Personaje guardado = personajeRepository.save(p);
        personajeBusquedaService.invalidateIndex();
        return guardado;
    }

    @Caching(evict = {
            @CacheEvict(value = "personajes-listado", allEntries = true),
            @CacheEvict(value = "personajes-catalogo", allEntries = true),
            @CacheEvict(value = "personajes-individual", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true),
            // Derivadas por slug: una edición/borrado de personaje debe refrescar
            // también su OG, matchups, votos por periodo e historial de ELO
            // (auditoría 2; allEntries porque las escrituras de admin son raras).
            @CacheEvict(value = "og-personaje", allEntries = true),
            @CacheEvict(value = "personaje-matchups", allEntries = true),
            @CacheEvict(value = "personaje-votos-periodo", allEntries = true),
            @CacheEvict(value = "personaje-elo-history", allEntries = true)
    })
    public List<Personaje> crearBatch(List<PersonajeCrearRequest> personajes) {
        List<Personaje> guardados = personajes.stream()
                .map(r -> personajeRepository.save(new Personaje(
                        r.slug(), r.nombre(), r.anime(),
                        r.descripcion(), r.imagenUrl())))
                .toList();
        personajeBusquedaService.invalidateIndex();
        return guardados;
    }
}
