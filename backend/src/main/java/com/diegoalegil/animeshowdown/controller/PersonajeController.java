package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Optional;

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

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

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
    public ResponseEntity<Personaje> buscarPorId(@PathVariable Long id) {
        Optional<Personaje> personaje = personajeRepository.findById(id);

        if (personaje.isPresent()) {
            return ResponseEntity.ok(personaje.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public Personaje crear(@RequestBody Personaje personaje) {
        return personajeRepository.save(personaje);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {

        if (!personajeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        personajeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<Personaje> actualizar(@PathVariable Long id, @RequestBody Personaje datos) {
        if (!personajeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        datos.setId(id);
        Personaje actualizado = personajeRepository.save(datos);
        return ResponseEntity.ok(actualizado);
    }

    @PostMapping("/batch")
    public List<Personaje> crearBatch(@RequestBody List<Personaje> personajes) {
        return personajeRepository.saveAll(personajes);
    }

    @PostMapping("/{id}/votar")
    public ResponseEntity<?> votar(@PathVariable Long id, @AuthenticationPrincipal Usuario usuario) {
        Optional<Personaje> personajeOpt = personajeRepository.findById(id);

        if (personajeOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Personaje personaje = personajeOpt.get();

        if (votoRepository.existsByPersonajeAndUsuario(personaje, usuario)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Ya has votado a este personaje");
        }

        Voto voto = new Voto(personaje, usuario);
        Voto guardado = votoRepository.save(voto);

        return ResponseEntity.ok(guardado);
    }

}
