package com.diegoalegil.animeshowdown.controller;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.VotoEnfrentamientoRequest;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/enfrentamientos")
public class EnfrentamientoController {

    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;

    public EnfrentamientoController(EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository) {
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
    }

    @PostMapping("/{id}/votar")
    public ResponseEntity<?> votar(@PathVariable Long id,
            @Valid @RequestBody VotoEnfrentamientoRequest request,
            @AuthenticationPrincipal Usuario usuario) {

        Optional<Enfrentamiento> enfOpt = enfrentamientoRepository.findById(id);
        if (enfOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Enfrentamiento enf = enfOpt.get();

        if (enf.getTorneo().getEstado() != EstadoTorneo.IN_PROGRESS) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Solo se puede votar en enfrentamientos de torneos IN_PROGRESS");
        }

        Long ganadorId = request.getPersonajeGanadorId();
        Personaje ganador;
        if (enf.getPersonaje1().getId().equals(ganadorId)) {
            ganador = enf.getPersonaje1();
        } else if (enf.getPersonaje2().getId().equals(ganadorId)) {
            ganador = enf.getPersonaje2();
        } else {
            return ResponseEntity.badRequest()
                    .body("El personaje no pertenece a este enfrentamiento");
        }

        if (votoRepository.existsByEnfrentamientoAndUsuario(enf, usuario)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Ya has votado este enfrentamiento");
        }

        Voto voto = new Voto(ganador, usuario, enf);
        Voto guardado = votoRepository.save(voto);

        return ResponseEntity.ok(guardado);
    }
}
