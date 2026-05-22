package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.MadrugadorDia;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.MadrugadorDiaRepository;

@Service
public class MadrugadorService {

    private final MadrugadorDiaRepository madrugadorDiaRepository;
    private final BadgeService badgeService;
    private final Clock clock;

    public MadrugadorService(MadrugadorDiaRepository madrugadorDiaRepository,
            BadgeService badgeService,
            Clock clock) {
        this.madrugadorDiaRepository = madrugadorDiaRepository;
        this.badgeService = badgeService;
        this.clock = clock;
    }

    @Transactional
    public Optional<MadrugadorDia> registrarPrimerVotoDelDia(Usuario usuario, Personaje personaje) {
        if (usuario == null || personaje == null || personaje.getSlug() == null) {
            return Optional.empty();
        }

        LocalDate fechaUtc = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDateTime horaUtc = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        String slug = personaje.getSlug();

        if (madrugadorDiaRepository.existsByPersonajeSlugAndFecha(slug, fechaUtc)) {
            return Optional.empty();
        }

        try {
            MadrugadorDia guardado = madrugadorDiaRepository.saveAndFlush(
                    new MadrugadorDia(slug, fechaUtc, usuario, horaUtc));
            badgeService.desbloquearMadrugador(usuario, personaje, horaUtc);
            return Optional.of(guardado);
        } catch (DataIntegrityViolationException e) {
            return Optional.empty();
        }
    }
}
