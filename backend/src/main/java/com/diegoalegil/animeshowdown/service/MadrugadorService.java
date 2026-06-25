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
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.MadrugadorDiaRepository;

@Service
public class MadrugadorService {

    private final MadrugadorDiaRepository madrugadorDiaRepository;
    private final BadgeService badgeService;
    private final NotificacionService notificacionService;
    private final Clock clock;

    public MadrugadorService(MadrugadorDiaRepository madrugadorDiaRepository,
            BadgeService badgeService,
            NotificacionService notificacionService,
            Clock clock) {
        this.madrugadorDiaRepository = madrugadorDiaRepository;
        this.badgeService = badgeService;
        this.notificacionService = notificacionService;
        this.clock = clock;
    }

    @Transactional
    public Optional<MadrugadorDia> registrarPrimerVotoDelDia(
            Usuario usuario, Personaje personaje, LocalDate fechaVoto) {
        if (usuario == null || personaje == null || personaje.getSlug() == null) {
            return Optional.empty();
        }

        // La fecha viene SELLADA en la tx del voto (BadgeEventListener corre @Async
        // tras el commit). Sin ella, un voto de las 23:59 procesado tras medianoche
        // UTC se registraría como el madrugador del día siguiente y quemaría su
        // clave idempotente, robándole el reconocimiento al primer votante real de
        // ese día. Fallback a now() solo para eventos legacy sin fecha sellada.
        LocalDate fechaUtc = fechaVoto != null
                ? fechaVoto
                : LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDateTime horaUtc = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        String slug = personaje.getSlug();

        if (madrugadorDiaRepository.existsByPersonajeSlugAndFecha(slug, fechaUtc)) {
            return Optional.empty();
        }

        try {
            MadrugadorDia guardado = madrugadorDiaRepository.saveAndFlush(
                    new MadrugadorDia(slug, fechaUtc, usuario, horaUtc));
            badgeService.desbloquearMadrugador(usuario, personaje, horaUtc);
            // UNA sola notificación "madrugador" al día, sea cuantos personajes
            // sea. crearSiNoExiste es idempotente por eventoKey, así que la 1ª
            // del día la crea y las ~105 siguientes son no-op. Evita inundar la
            // campana con una notif por personaje (la queja de "46 notificaciones").
            notificacionService.crearSiNoExiste(
                    usuario,
                    NotificacionTipo.BADGE_DESBLOQUEADO,
                    "Madrugador del día",
                    "Has sido de los primeros en votar hoy. ¡Gracias por mover el ranking!",
                    "{\"codigo\":\"madrugador\",\"icono\":\"Sunrise\",\"rareza\":3}",
                    "madrugador:" + fechaUtc);
            return Optional.of(guardado);
        } catch (DataIntegrityViolationException e) {
            return Optional.empty();
        }
    }
}
