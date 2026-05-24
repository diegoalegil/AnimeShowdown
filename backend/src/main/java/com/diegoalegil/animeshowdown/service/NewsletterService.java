package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.NewsletterSub;
import com.diegoalegil.animeshowdown.repository.NewsletterSubRepository;
import com.diegoalegil.animeshowdown.security.LogSanitizer;

/**
 * Newsletter con double opt-in.
 *
 * <p>Flow:
 * <ol>
 *   <li>{@link #suscribir(String)} — crea fila no confirmada (o refresca
 *       token si ya existía sin confirmar) y dispara email asíncrono.</li>
 *   <li>{@link #confirmar(String)} — el user clica el link del email,
 *       marca confirmado=true y consume el token.</li>
 *   <li>{@link #unsubscribir(String)} — desuscribe via token persistente.
 *       Lo invocará el footer de los emails reales (bloque 8.6 futuro).</li>
 * </ol>
 *
 * <p>{@code suscribir} es idempotente: si el email ya existe pero no está
 * confirmado, refresca el token y reenvía el email — sin error 409 al
 * user para mejor UX. Si ya está confirmado, devuelve el estado sin tocar.
 */
@Service
public class NewsletterService {

    private static final Logger log = LoggerFactory.getLogger(NewsletterService.class);

    private final NewsletterSubRepository repo;
    private final EmailService emailService;
    private final String frontendBaseUrl;

    public NewsletterService(NewsletterSubRepository repo, EmailService emailService,
            @Value("${app.frontend-base-url:https://animeshowdown.dev}") String frontendBaseUrl) {
        this.repo = repo;
        this.emailService = emailService;
        this.frontendBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1)
                : frontendBaseUrl;
    }

    public enum ResultadoSuscripcion {
        CREADA, REENVIADA, YA_CONFIRMADA
    }

    @Transactional
    public ResultadoSuscripcion suscribir(String emailBruto) {
        if (emailBruto == null) {
            throw new IllegalArgumentException("email es obligatorio");
        }
        String email = emailBruto.trim().toLowerCase();
        if (email.isEmpty() || !email.contains("@")) {
            throw new IllegalArgumentException("email inválido");
        }

        Optional<NewsletterSub> existente = repo.findByEmail(email);
        if (existente.isPresent()) {
            NewsletterSub s = existente.get();
            if (s.isConfirmado()) {
                log.info("Newsletter: email ya confirmado, no-op: {}", LogSanitizer.email(email));
                return ResultadoSuscripcion.YA_CONFIRMADA;
            }
            // No confirmado: refrescamos token y reenviamos el email.
            s.refrescarTokenConfirm();
            repo.save(s);
            disparEmail(s);
            log.info("Newsletter: token refrescado y email reenviado: {}", LogSanitizer.email(email));
            return ResultadoSuscripcion.REENVIADA;
        }

        NewsletterSub nueva = new NewsletterSub(email);
        repo.save(nueva);
        disparEmail(nueva);
        log.info("Newsletter: nueva suscripción pendiente: {}", LogSanitizer.email(email));
        return ResultadoSuscripcion.CREADA;
    }

    private void disparEmail(NewsletterSub s) {
        String link = frontendBaseUrl + "/newsletter/confirmar?token=" + s.getTokenConfirm();
        emailService.enviarConfirmacionNewsletter(s.getEmail(), link);
    }

    @Transactional
    public boolean confirmar(String token) {
        if (token == null || token.isBlank()) return false;
        Optional<NewsletterSub> opt = repo.findByTokenConfirm(token);
        if (opt.isEmpty()) {
            log.warn("Newsletter confirmar: token no encontrado");
            return false;
        }
        NewsletterSub s = opt.get();
        if (s.getConfirmExpiraEn() != null
                && s.getConfirmExpiraEn().isBefore(LocalDateTime.now())) {
            log.warn("Newsletter confirmar: token expirado para {}", LogSanitizer.email(s.getEmail()));
            return false;
        }
        s.marcarConfirmado();
        repo.save(s);
        log.info("Newsletter confirmada: {}", LogSanitizer.email(s.getEmail()));
        return true;
    }

    @Transactional
    public boolean unsubscribir(String tokenUnsubscribe) {
        if (tokenUnsubscribe == null || tokenUnsubscribe.isBlank()) return false;
        Optional<NewsletterSub> opt = repo.findByTokenUnsubscribe(tokenUnsubscribe);
        if (opt.isEmpty()) return false;
        repo.delete(opt.get());
        log.info("Newsletter desuscrita: {}", LogSanitizer.email(opt.get().getEmail()));
        return true;
    }
}
