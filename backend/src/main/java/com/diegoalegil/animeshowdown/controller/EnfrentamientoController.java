package com.diegoalegil.animeshowdown.controller;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.BracketUpdateEvent;
import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.VotoEnfrentamientoRequest;
import com.diegoalegil.animeshowdown.dto.VotoRegistradoDto;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Value;

@RestController
@RequestMapping("/api/enfrentamientos")
public class EnfrentamientoController {

    private static final Logger log = LoggerFactory.getLogger(EnfrentamientoController.class);

    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;
    private final SimpMessagingTemplate messaging;
    private final ApplicationEventPublisher eventPublisher;
    private final boolean requiereEmailVerificado;

    public EnfrentamientoController(EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository,
            @Autowired(required = false) SimpMessagingTemplate messaging,
            ApplicationEventPublisher eventPublisher,
            @Value("${app.email-verification.required-to-vote:true}") boolean requiereEmailVerificado) {
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
        this.messaging = messaging;
        this.eventPublisher = eventPublisher;
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

    // Audit P2 (2026-05-17): @Transactional es OBLIGATORIO aquí, no estético.
    // Sin él, votoRepository.save() corre en auto-commit (su propia tx), y
    // cuando llega `eventPublisher.publishEvent(new VotoRegistradoEvent(...))`
    // ya no hay tx activa. BadgeEventListener escucha en AFTER_COMMIT, que sin
    // tx por defecto descarta el evento silenciosamente → badges como
    // primer_voto / cien_votos / mil_votos nunca se desbloquean por el flujo
    // real, solo por desbloqueo manual desde BadgeService. spring.jpa.open-in-view
    // está off, así que el filtro web tampoco abre una tx implícita.
    @PostMapping("/{id}/votar")
    @Transactional
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

        Personaje p1 = enf.getPersonaje1();
        Personaje p2 = enf.getPersonaje2();
        // Counts post-voto. Para el ganador es el total real; para el
        // perdedor es el mismo que pre-voto. Los reutilizamos para el push
        // WS para no hacer dos rondas a la BBDD.
        long votosP1 = votoRepository.countByEnfrentamientoAndPersonaje(enf, p1);
        long votosP2 = votoRepository.countByEnfrentamientoAndPersonaje(enf, p2);
        Personaje perdedor = ganador.getId().equals(p1.getId()) ? p2 : p1;
        long votosGanador = ganador.getId().equals(p1.getId()) ? votosP1 : votosP2;
        long votosPerdedor = perdedor.getId().equals(p1.getId()) ? votosP1 : votosP2;

        // Plan v2 §2.13: push del estado actualizado del match al topic del
        // torneo. Los clientes viendo /torneos/{slug} actualizan el bracket
        // sin esperar al polling. Best-effort: si falla no afecta al voto.
        publicarBracketUpdate(enf, p1, votosP1, p2, votosP2);

        // Plan v2 §4.2: evento de dominio. BadgeEventListener escucha tras
        // commit y desbloquea badges de umbral (primer_voto/cien/mil).
        // Diseño extensible — futuros listeners podrán reaccionar también.
        eventPublisher.publishEvent(new VotoRegistradoEvent(usuario, enf));

        return ResponseEntity.ok(new VotoRegistradoDto(
                guardado.getId(),
                ganador.getId(),
                votosGanador,
                perdedor.getId(),
                votosPerdedor,
                1));
    }

    /**
     * Publica un {@link BracketUpdateEvent} al topic público del torneo
     * con los counts ya calculados por el caller (evitamos doble round-trip).
     */
    private void publicarBracketUpdate(Enfrentamiento enf,
            Personaje p1, long v1, Personaje p2, long v2) {
        if (messaging == null) return;
        try {
            BracketUpdateEvent ev = new BracketUpdateEvent(
                    enf.getTorneo().getId(),
                    enf.getId(),
                    p1 == null ? null : p1.getId(),
                    v1,
                    p2 == null ? null : p2.getId(),
                    v2,
                    v1 + v2);
            String topic = "/topic/torneo." + enf.getTorneo().getId() + ".bracket";
            messaging.convertAndSend(topic, ev);
        } catch (Exception e) {
            // Best-effort: el voto ya está guardado. El cliente lo verá en
            // el próximo polling 30s del fallback.
            log.warn("Push WS bracket update falló: enf={} err={}",
                    enf.getId(), e.getMessage());
        }
    }
}
