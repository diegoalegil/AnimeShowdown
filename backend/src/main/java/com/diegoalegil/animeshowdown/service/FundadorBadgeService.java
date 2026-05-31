package com.diegoalegil.animeshowdown.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.diegoalegil.animeshowdown.event.UsuarioRegistradoEvent;
import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.LogroRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@Service
public class FundadorBadgeService {

    public static final String CODIGO_FUNDADOR = "fundador";
    public static final int FUNDADOR_CUTOFF = 1000;

    private static final Logger log = LoggerFactory.getLogger(FundadorBadgeService.class);

    private final LogroRepository logroRepository;
    private final UsuarioRepository usuarioRepository;
    private final BadgeService badgeService;
    private final int fundadorCutoff;

    public FundadorBadgeService(
            LogroRepository logroRepository,
            UsuarioRepository usuarioRepository,
            BadgeService badgeService,
            @Value("${animeshowdown.badges.fundador.cutoff:" + FUNDADOR_CUTOFF + "}") int fundadorCutoff) {
        this.logroRepository = logroRepository;
        this.usuarioRepository = usuarioRepository;
        this.badgeService = badgeService;
        this.fundadorCutoff = Math.max(0, fundadorCutoff);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void sembrarYBackfill() {
        sembrarLogroSiFalta();
        backfillElegibles();
    }

    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT,
            fallbackExecution = true)
    public void onUsuarioRegistrado(UsuarioRegistradoEvent event) {
        if (event == null || event.usuarioId() == null) return;
        usuarioRepository.findById(event.usuarioId())
                .ifPresent(this::otorgarSiElegible);
    }

    public void backfillElegibles() {
        if (fundadorCutoff <= 0) return;
        List<Usuario> elegibles = usuarioRepository.findPrimerosPorFechaRegistro(
                PageRequest.of(0, fundadorCutoff));
        for (Usuario usuario : elegibles) {
            badgeService.desbloquear(usuario, CODIGO_FUNDADOR);
        }
        log.info("Backfill badge Fundador evaluado para {} usuario(s)", elegibles.size());
    }

    public void otorgarSiElegible(Usuario usuario) {
        if (fundadorCutoff <= 0 || usuario == null || usuario.getId() == null
                || usuario.getFechaRegistro() == null) {
            return;
        }
        sembrarLogroSiFalta();
        long posicion = usuarioRepository.posicionPorFechaRegistro(
                usuario.getFechaRegistro(), usuario.getId());
        if (posicion <= fundadorCutoff) {
            badgeService.desbloquear(usuario, CODIGO_FUNDADOR);
        }
    }

    public void sembrarLogroSiFalta() {
        if (logroRepository.findByCodigo(CODIGO_FUNDADOR).isPresent()) return;
        try {
            logroRepository.saveAndFlush(new Logro(
                    CODIGO_FUNDADOR,
                    "Fundador",
                    "Estuviste entre las primeras 1000 cuentas de AnimeShowdown.",
                    "Crown",
                    (short) 5));
            log.info("Logro Fundador sembrado en el catálogo");
        } catch (DataIntegrityViolationException e) {
            if (logroRepository.findByCodigo(CODIGO_FUNDADOR).isEmpty()) {
                throw e;
            }
        }
    }
}
