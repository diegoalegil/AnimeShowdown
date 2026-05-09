package com.diegoalegil.animeshowdown.controller;

import java.time.LocalDateTime;
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

import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;

@RestController
@RequestMapping("/api/torneos")
public class TorneoController {

    private final TorneoRepository torneoRepository;

    public TorneoController(TorneoRepository torneoRepository) {
        this.torneoRepository = torneoRepository;
    }

    @GetMapping
    public List<Torneo> listarTodos() {
        return torneoRepository.findAll();
    }

    @PostMapping
    public Torneo crear(@RequestBody TorneoCrearRequest request) {
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
}
