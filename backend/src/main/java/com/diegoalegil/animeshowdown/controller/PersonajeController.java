package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.PersonajeActualizarRequest;
import com.diegoalegil.animeshowdown.dto.PersonajeCrearRequest;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/personajes")
public class PersonajeController {

    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;

    public PersonajeController(PersonajeRepository personajeRepository,
            VotoRepository votoRepository) {
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
    }

    @GetMapping
    public List<Personaje> listarTodos(@RequestParam(required = false) String anime) {
        if (anime != null) {
            return personajeRepository.findByAnime(anime);
        }
        return personajeRepository.findAll();
    }

    @GetMapping("/{id}")
    public Personaje buscarPorId(@PathVariable Long id) {
        return personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id));
    }

    /**
     * Crea un personaje desde un DTO validado. Antes aceptaba la entidad
     * Personaje directa sin @Valid, permitiendo slugs vacíos o caracteres
     * inválidos. Ahora PersonajeCrearRequest impone formato del slug,
     * longitudes y obligatoriedad de slug/nombre/anime.
     */
    @PostMapping
    public ResponseEntity<Personaje> crear(@Valid @RequestBody PersonajeCrearRequest request) {
        Personaje p = new Personaje(
                request.getSlug(),
                request.getNombre(),
                request.getAnime(),
                request.getDescripcion(),
                request.getImagenUrl());
        Personaje guardado = personajeRepository.save(p);
        return ResponseEntity.status(HttpStatus.CREATED).body(guardado);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!personajeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        personajeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Actualización parcial: el cliente manda solo los campos a cambiar.
     * Los null se ignoran (preservan el valor previo). PersonajeActualizar
     * Request valida formato y tamaño pero no obliga a estar presentes.
     */
    @PutMapping("/{id}")
    public Personaje actualizar(
            @PathVariable Long id,
            @Valid @RequestBody PersonajeActualizarRequest datos) {
        Personaje p = personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id));
        if (datos.getSlug() != null) p.setSlug(datos.getSlug());
        if (datos.getNombre() != null) p.setNombre(datos.getNombre());
        if (datos.getAnime() != null) p.setAnime(datos.getAnime());
        if (datos.getDescripcion() != null) p.setDescripcion(datos.getDescripcion());
        if (datos.getImagenUrl() != null) p.setImagenUrl(datos.getImagenUrl());
        return personajeRepository.save(p);
    }

    @PostMapping("/batch")
    public List<Personaje> crearBatch(@RequestBody List<@Valid PersonajeCrearRequest> personajes) {
        return personajes.stream()
                .map(r -> personajeRepository.save(new Personaje(
                        r.getSlug(), r.getNombre(), r.getAnime(),
                        r.getDescripcion(), r.getImagenUrl())))
                .toList();
    }

    @PostMapping("/{id}/votar")
    public ResponseEntity<Voto> votar(@PathVariable Long id, @AuthenticationPrincipal Usuario usuario) {
        Personaje personaje = personajeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Personaje no encontrado: id=" + id));

        if (votoRepository.existsByPersonajeAndUsuario(personaje, usuario)) {
            throw new IllegalStateException("Ya has votado a este personaje");
        }

        Voto voto = new Voto(personaje, usuario);
        return ResponseEntity.ok(votoRepository.save(voto));
    }
}
