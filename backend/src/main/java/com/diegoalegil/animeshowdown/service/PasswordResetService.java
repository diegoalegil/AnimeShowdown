package com.diegoalegil.animeshowdown.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.event.PasswordResetSolicitadoEvent;
import com.diegoalegil.animeshowdown.model.PasswordResetToken;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PasswordResetTokenRepository;
import com.diegoalegil.animeshowdown.repository.RefreshTokenRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.LogSanitizer;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int CODIGO_LENGTH_DIGITS = 6;
    private static final long EXPIRACION_MINUTOS = 15;
    private static final int MAX_SOLICITUDES_24H = 3;
    private static final long VENTANA_SOLICITUDES_HORAS = 24;
    private static final int MAX_INTENTOS_CODIGO = 5;

    private final PasswordResetTokenRepository tokenRepo;
    private final UsuarioRepository usuarioRepo;
    private final RefreshTokenRepository refreshTokenRepo;
    private final ApplicationEventPublisher eventPublisher;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(
            PasswordResetTokenRepository tokenRepo,
            UsuarioRepository usuarioRepo,
            RefreshTokenRepository refreshTokenRepo,
            ApplicationEventPublisher eventPublisher,
            PasswordEncoder passwordEncoder) {
        this.tokenRepo = tokenRepo;
        this.usuarioRepo = usuarioRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.eventPublisher = eventPublisher;
        this.passwordEncoder = passwordEncoder;
    }

    /** Mensaje genérico unificado para todos los errores de reset (anti-enumeration). */
    private static final String ERROR_GENERICO = "Email o código inválido o expirado";

    private String normalizarEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private String normalizarCodigo(String codigo) {
        return codigo == null ? "" : codigo.trim();
    }

    @Transactional
    public void solicitarReset(String email) {
        String emailNorm = normalizarEmail(email);
        Optional<Usuario> userOpt = usuarioRepo.findForUpdateByEmail(emailNorm);
        if (userOpt.isEmpty()) {
            log.warn("Forgot-password: email no registrado: {}", LogSanitizer.email(emailNorm));
            return;
        }
        Usuario u = userOpt.get();
        LocalDateTime ahora = LocalDateTime.now();
        long solicitudesRecientes = tokenRepo.countByUsuarioIdAndCreadoEnAfter(
                u.getId(),
                ahora.minusHours(VENTANA_SOLICITUDES_HORAS));
        if (solicitudesRecientes >= MAX_SOLICITUDES_24H) {
            log.warn("Forgot-password limitado: email={} userId={}",
                    LogSanitizer.email(u.getEmail()), u.getId());
            return;
        }
        int tokensPrevios = tokenRepo.marcarTodosComoUsadosByUsuarioId(u.getId(), ahora);
        String codigo = generarCodigo();
        String codigoHash = passwordEncoder.encode(codigo);
        PasswordResetToken token = new PasswordResetToken(
                u.getId(),
                codigoHash,
                ahora.plusMinutes(EXPIRACION_MINUTOS));
        token.setCreadoEn(ahora);
        tokenRepo.save(token);
        log.info("Token de reset generado para userId={} expiraEn={} tokensPreviosUsados={}",
                u.getId(), token.getExpiraEn(), tokensPrevios);
        // El email sale en AFTER_COMMIT (EmailDispatchListener): solo si el
        // token quedó persistido — un rollback de esta tx no manda código muerto.
        eventPublisher.publishEvent(
                new PasswordResetSolicitadoEvent(u.getEmail(), u.getUsername(), codigo));
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void resetearPassword(String email, String codigo, String newPassword) {
        // Mensaje unificado para los 3 casos (email no existe, código no existe, código expirado)
        // — evita filtrar info al atacante que pueda enumerar usuarios o adivinar códigos
        LocalDateTime ahora = LocalDateTime.now();
        String emailNorm = normalizarEmail(email);
        String codigoNorm = normalizarCodigo(codigo);
        Usuario u = usuarioRepo.findForUpdateByEmail(emailNorm)
                .orElseThrow(() -> new IllegalArgumentException(ERROR_GENERICO));
        PasswordResetToken token = tokenRepo
                .findFirstByUsuarioIdAndUsadoFalseOrderByCreadoEnDesc(u.getId())
                .orElseThrow(() -> new IllegalArgumentException(ERROR_GENERICO));
        if (token.getExpiraEn().isBefore(ahora)
                || token.getCodigoHash() == null
                || token.getIntentosFallidos() >= MAX_INTENTOS_CODIGO) {
            throw new IllegalArgumentException(ERROR_GENERICO);
        }
        if (!passwordEncoder.matches(codigoNorm, token.getCodigoHash())) {
            tokenRepo.registrarIntentoFallido(token.getId(), MAX_INTENTOS_CODIGO, ahora);
            throw new IllegalArgumentException(ERROR_GENERICO);
        }
        int consumidos = tokenRepo.consumirActivoPorId(
                token.getId(), ahora, ahora, MAX_INTENTOS_CODIGO);
        if (consumidos != 1) {
            throw new IllegalArgumentException(ERROR_GENERICO);
        }
        u.setPassword(passwordEncoder.encode(newPassword));
        u.incrementarTokenVersion();
        usuarioRepo.save(u);
        // tras reset, revoca TODAS las sesiones activas
        // del usuario. Sin esto, una refresh cookie robada antes del reset
        // seguía siendo válida hasta su expiración (30 días) — el flujo
        // canónico "olvidé mi password" tenía que cerrar la puerta a sesiones
        // potencialmente comprometidas, no solo cambiar la contraseña.
        int revocados = refreshTokenRepo.revocarTodosDelUsuario(u, ahora);
        log.info("Password reseteada para userId={} (refresh tokens revocados={})", u.getId(), revocados);
    }

    private String generarCodigo() {
        int max = (int) Math.pow(10, CODIGO_LENGTH_DIGITS);
        return String.format("%0" + CODIGO_LENGTH_DIGITS + "d", random.nextInt(max));
    }
}
