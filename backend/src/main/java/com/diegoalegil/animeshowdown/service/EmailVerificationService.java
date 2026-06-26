package com.diegoalegil.animeshowdown.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.event.EmailVerificacionEmitidaEvent;
import com.diegoalegil.animeshowdown.model.EmailVerification;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EmailVerificationRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.AdminEmails;

/**
 * Orquesta el ciclo de verificación de email:
 *
 *   emitir(usuario)
 *     ↓ invalida cualquier token activo previo del usuario
 *     ↓ genera token random Base64URL 32 bytes
 *     ↓ guarda con expira_en = now + 24h
 *     ↓ dispara email con link al frontend tras el commit (EmailDispatchListener)
 *
 *   verificar(token)
 *     ↓ valida activo + no expirado
 *     ↓ marca token como usado + usuario → ACTIVO
 *
 *   reenviar(usuario)
 *     ↓ equivalente a emitir(): invalida lo viejo + emite nuevo + email.
 *
 * Cuando llegue el cron de la capa correspondiente, también limpiará tokens vencidos
 * vía EmailVerificationRepository.borrarVencidos.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final int TOKEN_BYTES = 32; // 256 bits = 43 chars Base64URL
    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailVerificationRepository repository;
    private final UsuarioRepository usuarioRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final NotificacionService notificacionService;
    private final BadgeService badgeService;
    private final ReferralService referralService;
    private final AdminEmails adminEmails;
    private final AnimeShowdownMetrics metrics;
    private final String frontendBaseUrl;
    private final long ttlHoras;

    public EmailVerificationService(
            EmailVerificationRepository repository,
            UsuarioRepository usuarioRepository,
            ApplicationEventPublisher eventPublisher,
            NotificacionService notificacionService,
            BadgeService badgeService,
            ReferralService referralService,
            AdminEmails adminEmails,
            AnimeShowdownMetrics metrics,
            @Value("${app.frontend-base-url:https://animeshowdown.dev}") String frontendBaseUrl,
            @Value("${app.email-verification.ttl-hours:24}") long ttlHoras) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
        this.eventPublisher = eventPublisher;
        this.notificacionService = notificacionService;
        this.badgeService = badgeService;
        this.referralService = referralService;
        this.adminEmails = adminEmails;
        this.metrics = metrics;
        this.frontendBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1)
                : frontendBaseUrl;
        this.ttlHoras = ttlHoras;
    }

    /**
     * Crea token nuevo, invalida los anteriores activos, dispara email.
     * Llamada típicamente desde AuthController.registro y resend-verification.
     */
    @Transactional
    public void emitir(Usuario usuario) {
        Usuario usuarioBloqueado = usuarioRepository.findForUpdateById(usuario.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "Usuario no encontrado al emitir verificación: " + usuario.getId()));
        if (usuarioBloqueado.estaVerificado()) {
            return;
        }

        LocalDateTime ahora = LocalDateTime.now();
        repository.invalidarActivasDelUsuario(usuarioBloqueado, ahora);
        String token = generarTokenPlano();
        LocalDateTime expira = ahora.plusHours(ttlHoras);
        repository.save(new EmailVerification(usuarioBloqueado, token, expira));
        String link = frontendBaseUrl + "/verify?token=" + token;
        // El email sale en AFTER_COMMIT (EmailDispatchListener): solo si el
        // token quedó persistido — el link del email siempre existe en BBDD.
        eventPublisher.publishEvent(new EmailVerificacionEmitidaEvent(
                usuarioBloqueado.getEmail(), usuarioBloqueado.getUsername(), link));
        metrics.emailVerificacionEmitida();
        log.info("EmailVerification emitida: usuario={} expira={}", usuarioBloqueado.getUsername(), expira);
    }

    /**
     * Consume el token y pasa al usuario a ACTIVO. Idempotente: si ya estaba
     * verificado, devuelve true igualmente. Devuelve false si el token es
     * inválido o expirado.
     */
    @Transactional
    public boolean verificar(String token) {
        if (token == null || token.isBlank()) return false;
        LocalDateTime ahora = LocalDateTime.now();
        Optional<EmailVerification> opt = repository.findByToken(token);
        if (opt.isEmpty()) {
            log.warn("EmailVerification verificar: token no encontrado");
            return false;
        }
        EmailVerification ev = opt.get();

        Usuario u = usuarioRepository.findForUpdateById(ev.getUsuario().getId())
                .orElseThrow(() -> new IllegalStateException(
                        "Usuario no encontrado al verificar email: " + ev.getUsuario().getId()));
        if (ev.getExpiraEn().isBefore(ahora)) {
            log.info("EmailVerification expirada para usuario={}", ev.getUsuario().getUsername());
            return false;
        }
        int consumidos = repository.consumirActivaPorToken(token, ahora);
        if (consumidos == 0) {
            // Reutilización del link o token invalidado por reenvío. Si el
            // usuario ya está ACTIVO lo dejamos pasar como idempotente; si no,
            // el token ya no es válido para activar la cuenta.
            return usuarioRepository.findById(u.getId())
                    .map(Usuario::estaVerificado)
                    .orElse(false);
        }

        u.setEstadoVerificacion(EstadoVerificacion.ACTIVO);
        // la auto-promoción a ADMIN se hace AQUÍ (no en
        // registro). Requiere que el dueño del email haya verificado
        // realmente — sin acceso al inbox no hay promoción. Si la lista
        // de admins está vacía (ADMIN_EMAILS no configurado), nadie sube.
        if (u.getRol() != Rol.ADMIN && adminEmails.contains(u.getEmail())) {
            u.setRol(Rol.ADMIN);
            log.info("Auto-promoción a ADMIN tras verificar email: usuario={}", u.getUsername());
        }
        usuarioRepository.save(u);
        metrics.emailVerificacionConfirmada();
        log.info("Email verificado: usuario={}", u.getUsername());

        // Notificación de bienvenida tras verificación. Es
        // el primer item que verá el usuario en su campanita y demuestra
        // que el sistema funciona. Trigger único por usuario — solo se
        // dispara la primera vez (verificar() es idempotente y los siguientes
        // calls salen por el return previo de "ya está usado").
        notificacionService.crear(
                u,
                NotificacionTipo.BIENVENIDA,
                "¡Bienvenido a AnimeShowdown, " + u.getUsername() + "!",
                "Tu email está verificado y tu cuenta lista para votar, crear torneos y desbloquear logros.",
                null);

        // Si este usuario vino con referrer, su verificación
        // hace que cuente como referido "activo". Comprobamos si el referrer
        // alcanza ya el umbral para desbloquear el badge reclutador.
        try {
            Usuario referrer = u.getReferredBy();
            if (referrer != null) {
                long cuenta = referralService.stats(referrer).invitadosVerificados();
                if (cuenta >= ReferralService.UMBRAL_RECLUTADOR) {
                    badgeService.desbloquear(referrer, "reclutador");
                }
            }
        } catch (Exception e) {
            log.warn("EmailVerification: re-evaluación badge reclutador falló: {}",
                    e.getMessage());
        }
        return true;
    }

    private static String generarTokenPlano() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
