package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

import jakarta.persistence.EntityNotFoundException;

/**
 * Lógica de negocio de torneos. Antes vivía en TorneoController mezclada con
 * la capa HTTP (ResponseEntity, status codes, validación de inputs) — ahora
 * el controller solo orquesta HTTP y delega aquí.
 *
 * Las violaciones de regla de negocio se lanzan como IllegalStateException
 * (mapeado a 409 por GlobalExceptionHandler) o IllegalArgumentException (400).
 * EntityNotFoundException → 404.
 */
@Service
public class TorneoService {

    private static final Logger log = LoggerFactory.getLogger(TorneoService.class);

    private final TorneoRepository torneoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;

    public TorneoService(
            TorneoRepository torneoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            PersonajeRepository personajeRepository,
            VotoRepository votoRepository) {
        this.torneoRepository = torneoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
    }

    public List<Torneo> listarTodos() {
        return torneoRepository.findAll();
    }

    public Torneo crear(TorneoCrearRequest request) {
        Torneo torneo = new Torneo(request.getNombre(), request.getDescripcion());
        return torneoRepository.save(torneo);
    }

    @Transactional
    public Torneo iniciar(Long id) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));

        if (torneo.getEstado() != EstadoTorneo.BORRADOR) {
            throw new IllegalStateException("Solo se pueden iniciar torneos en estado BORRADOR");
        }

        torneo.setEstado(EstadoTorneo.ACTIVO);
        torneo.setFechaInicio(LocalDateTime.now());
        return torneoRepository.save(torneo);
    }

    @Transactional
    public List<Enfrentamiento> crearEnfrentamientos(Long torneoId, List<EnfrentamientoCrearRequest> requests) {
        Torneo torneo = torneoRepository.findById(torneoId)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + torneoId));

        if (torneo.getEstado() == EstadoTorneo.FINALIZADO) {
            throw new IllegalStateException("No se pueden añadir enfrentamientos a un torneo FINALIZADO");
        }

        List<Enfrentamiento> creados = new ArrayList<>();
        for (EnfrentamientoCrearRequest req : requests) {
            // Validación de regla de negocio: un personaje no puede luchar contra sí mismo.
            if (req.getPersonaje1Id() != null && req.getPersonaje1Id().equals(req.getPersonaje2Id())) {
                throw new IllegalArgumentException(
                        "Un personaje no puede enfrentarse a sí mismo (id=" + req.getPersonaje1Id() + ")");
            }

            Personaje p1 = personajeRepository.findById(req.getPersonaje1Id())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Personaje no encontrado: id=" + req.getPersonaje1Id()));
            Personaje p2 = personajeRepository.findById(req.getPersonaje2Id())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Personaje no encontrado: id=" + req.getPersonaje2Id()));

            Enfrentamiento e = new Enfrentamiento(torneo, p1, p2);
            creados.add(enfrentamientoRepository.save(e));
        }
        return creados;
    }

    /**
     * Cierra el torneo y resuelve ganadores por conteo de votos en cada
     * enfrentamiento. Si hay empate exacto el ganador queda null (se gestiona
     * en frontend con un fallback determinístico por ELO).
     */
    @Transactional
    public Torneo finalizar(Long id) {
        Torneo torneo = torneoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Torneo no encontrado: id=" + id));

        if (torneo.getEstado() != EstadoTorneo.ACTIVO) {
            throw new IllegalStateException("Solo se pueden finalizar torneos en estado ACTIVO");
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
        log.info("Torneo {} finalizado con {} enfrentamientos resueltos", id, enfrentamientos.size());
        return guardado;
    }
}
