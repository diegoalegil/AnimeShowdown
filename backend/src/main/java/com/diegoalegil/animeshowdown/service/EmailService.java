package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String from;
    private final boolean enabled;

    public EmailService(
            @Autowired(required = false) JavaMailSender mailSender,
            @Value("${spring.mail.from:noreply@animeshowdown.local}") String from,
            @Value("${spring.mail.host:}") String host) {
        this.mailSender = mailSender;
        this.from = from;
        this.enabled = mailSender != null && host != null && !host.isBlank();
        if (this.enabled) {
            log.info("EmailService activo: host={} from={}", host, from);
        } else {
            log.warn("EmailService DESACTIVADO (falta SMTP_HOST). Códigos de reset se logean en consola.");
        }
    }

    @Async
    public void enviarCodigoReset(String to, String username, String codigo) {
        if (!enabled) {
            log.warn("[EMAIL FALLBACK] Reset code para {} ({}): {}", to, username, codigo);
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject("AnimeShowdown — Código para restablecer tu contraseña");
            msg.setText(
                "Hola " + username + ",\n\n" +
                "Tu código para restablecer la contraseña es:\n\n" +
                "    " + codigo + "\n\n" +
                "El código expira en 15 minutos. Si no fuiste tú, ignora este mensaje.\n\n" +
                "— AnimeShowdown"
            );
            mailSender.send(msg);
            log.info("Email de reset enviado a {}", to);
        } catch (Exception e) {
            // Como esto corre en async, no propagamos la excepción al request HTTP.
            // Solo logeamos para debug; el código sigue válido en BBDD para que el
            // usuario lo vea en logs si SMTP falla, o reintente la petición.
            log.error("Error enviando email de reset a {}: {} (código actual: {})",
                    to, e.getMessage(), codigo);
        }
    }
}
