package com.diegoalegil.animeshowdown.controller;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/torneos")
public class TorneoController {

    private final TorneoRepository torneoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;

    public TorneoController(TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            PersonajeRepository personajeRepository,
            VotoRepository votoRepository) {
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
    }

    @GetMapping
    public List<Torneo> listarTodos() {
        return torneoRepository.findAll();
    }

    @PostMapping
    public Torneo crear(@Valid @RequestBody TorneoCrearRequest request) {
        Torneo torneo = new Torneo(request.getNombre(), request.getDescripcion());
        return torneoRepository.save(torneo);
    }

    @PutMapping("/{id}/iniciar")
    public ResponseEntity<?> iniciar(@PathVariable Long id) {
        Optional<Torneo> torneoOpt = torneoRepository.findById(id);

        if (torneoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Torneo torneo = torneoOpt.get();

        if (torneo.getEstado() != EstadoTorneo.BORRADOR) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Solo se pueden iniciar torneos en estado BORRADOR");
        }

        torneo.setEstado(EstadoTorneo.ACTIVO);
        torneo.setFechaInicio(LocalDateTime.now());
        Torneo guardado = torneoRepository.save(torneo);

        return ResponseEntity.ok(guardado);
    }

    @PostMapping("/{id}/enfrentamientos")
    public ResponseEntity<?> crearEnfrentamientos(@PathVariable Long id,
            @Valid @RequestBody List<@Valid EnfrentamientoCrearRequest> requests) {

        Optional<Torneo> torneoOpt = torneoRepository.findById(id);
        if (torneoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Torneo torneo = torneoOpt.get();

        if (torneo.getEstado() == EstadoTorneo.FINALIZADO) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("No se pueden añadir enfrentamientos a un torneo FINALIZADO");
        }

        List<Enfrentamiento> creados = new ArrayList<>();
        for (EnfrentamientoCrearRequest req : requests) {
            Optional<Personaje> p1Opt = personajeRepository.findById(req.getPersonaje1Id());
            Optional<Personaje> p2Opt = personajeRepository.findById(req.getPersonaje2Id());

            if (p1Opt.isEmpty() || p2Opt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Personaje no encontrado: " + req.getPersonaje1Id() + " o " + req.getPersonaje2Id());
            }

            Enfrentamiento e = new Enfrentamiento(torneo, p1Opt.get(), p2Opt.get());
            creados.add(enfrentamientoRepository.save(e));
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(creados);
    }

    @PutMapping("/{id}/finalizar")
    public ResponseEntity<?> finalizar(@PathVariable Long id) {
        Optional<Torneo> torneoOpt = torneoRepository.findById(id);

        if (torneoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Torneo torneo = torneoOpt.get();

        if (torneo.getEstado() != EstadoTorneo.ACTIVO) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Solo se pueden finalizar torneos en estado ACTIVO");
        }

        List<Enfrentamiento> enfrentamientos = enfrentamientoRepository.findByTorneo(torneo);
        for (Enfrentamiento enf : enfrentamientos) {
            long votosP1 = votoRepository.countByEnfrentamientoAndPersonaje(enf, enf.getPersonaje1());
            long votosP2 = votoRepository.countByEnfrentamientoAndPersonaje(enf, enf.getPersonaje2());

            if (votosP1 > votosP2) {
                enf.setGanador(enf.getPersonaje1());
            } else if (votosP2 > votosP1) {
                enf.setGanador(enf.getPersonaje2());
            }
            enfrentamientoRepository.save(enf);
        }

        torneo.setEstado(EstadoTorneo.FINALIZADO);
        torneo.setFechaFinalizacion(LocalDateTime.now());
        Torneo guardado = torneoRepository.save(torneo);

        return ResponseEntity.ok(guardado);
    }
}
