package com.diegoalegil.animeshowdown.controller;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.VotoEnfrentamientoRequest;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Value;

@RestController
@RequestMapping("/api/enfrentamientos")
public class EnfrentamientoController {

    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;
    private final boolean requiereEmailVerificado;

    public EnfrentamientoController(EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository,
            @Value("${app.email-verification.required-to-vote:true}") boolean requiereEmailVerificado) {
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
        this.requiereEmailVerificado = requiereEmailVerificado;
    }

    /**
     * Devuelve un enfrentamiento "abierto" aleatorio (de un torneo
     * IN_PROGRESS, con ambos personajes y sin ganador) para que VotarPage
     * pueda mostrarlo en modo backend. 404 si ahora mismo no hay matches
     * abiertos — el frontend hace fallback a modo casual con pares random
     * locales (Plan v2 §1.1).
     */
    @GetMapping("/aleatorio")
    public ResponseEntity<EnfrentamientoDto> aleatorio() {
        return enfrentamientoRepository.findEnfrentamientoAbiertoAleatorio()
                .map(e -> ResponseEntity.ok(EnfrentamientoDto.from(e, null)))
                .orElseGet(() -> ResponseEntity.notFound().build());
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

        // Plan v2 §2.4: usuarios PENDIENTE de verificación de email no
        // pueden votar. Toggle vía app.email-verification.required-to-vote
        // (true en prod, false en tests para no obligar al fixture a
        // simular el flujo completo de email). 403 con mensaje claro.
        if (requiereEmailVerificado && !usuario.estaVerificado()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Necesitas verificar tu email antes de votar. Revisa tu bandeja de entrada.");
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
