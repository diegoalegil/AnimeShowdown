package com.diegoalegil.animeshowdown.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.PasswordResetToken;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PasswordResetTokenRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int CODIGO_LENGTH_DIGITS = 6;
    private static final long EXPIRACION_MINUTOS = 15;

    private final PasswordResetTokenRepository tokenRepo;
    private final UsuarioRepository usuarioRepo;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(
            PasswordResetTokenRepository tokenRepo,
            UsuarioRepository usuarioRepo,
            EmailService emailService,
            PasswordEncoder passwordEncoder) {
        this.tokenRepo = tokenRepo;
        this.usuarioRepo = usuarioRepo;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
    }

    /** Mensaje genérico unificado para todos los errores de reset (anti-enumeration). */
    private static final String ERROR_GENERICO = "Email o código inválido o expirado";

    private String normalizarEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    @Transactional
    public void solicitarReset(String email) {
        String emailNorm = normalizarEmail(email);
        Optional<Usuario> userOpt = usuarioRepo.findByEmail(emailNorm);
        if (userOpt.isEmpty()) {
            log.warn("Forgot-password: email no registrado: {}", emailNorm);
            return;
        }
        Usuario u = userOpt.get();
        // Limpia tokens previos del usuario (1 token activo a la vez)
        tokenRepo.deleteAllByUsuarioId(u.getId());
        String codigo = generarCodigo();
        PasswordResetToken token = new PasswordResetToken(
                u.getId(),
                codigo,
                LocalDateTime.now().plusMinutes(EXPIRACION_MINUTOS));
        tokenRepo.save(token);
        log.info("Token de reset generado para userId={} expiraEn={}", u.getId(), token.getExpiraEn());
        emailService.enviarCodigoReset(u.getEmail(), u.getUsername(), codigo);
    }

    @Transactional
    public void resetearPassword(String email, String codigo, String newPassword) {
        // Mensaje unificado para los 3 casos (email no existe, código no existe, código expirado)
        // — evita filtrar info al atacante que pueda enumerar usuarios o adivinar códigos
        String emailNorm = normalizarEmail(email);
        Usuario u = usuarioRepo.findByEmail(emailNorm)
                .orElseThrow(() -> new IllegalArgumentException(ERROR_GENERICO));
        PasswordResetToken token = tokenRepo
                .findFirstByUsuarioIdAndCodigoAndUsadoFalseOrderByCreadoEnDesc(u.getId(), codigo)
                .orElseThrow(() -> new IllegalArgumentException(ERROR_GENERICO));
        if (token.getExpiraEn().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException(ERROR_GENERICO);
        }
        u.setPassword(passwordEncoder.encode(newPassword));
        usuarioRepo.save(u);
        token.setUsado(true);
        tokenRepo.save(token);
        log.info("Password reseteada para userId={}", u.getId());
    }

    private String generarCodigo() {
        int max = (int) Math.pow(10, CODIGO_LENGTH_DIGITS);
        return String.format("%0" + CODIGO_LENGTH_DIGITS + "d", random.nextInt(max));
    }
}
