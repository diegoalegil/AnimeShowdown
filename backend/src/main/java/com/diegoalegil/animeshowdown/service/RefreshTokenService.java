package com.diegoalegil.animeshowdown.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.RefreshToken;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.RefreshTokenRepository;

/**
 * Gestión de refresh tokens (Plan v2 §1.3).
 *
 * Flujo:
 *
 *   1. emitir(usuario, request) — al login. Genera un random 256-bit
 *      encoded como Base64URL (43 chars), lo hashea SHA-256, persiste
 *      el HASH, devuelve el plano al caller para que lo setee como
 *      cookie httpOnly.
 *
 *   2. rotar(plano, request) — al /refresh. Hashea el plano, busca por
 *      hash. Si activo, revoca el viejo y emite uno nuevo en una sola
 *      transacción. Si está revocado (potencial token replay), revoca
 *      TODAS las sesiones del usuario como defensa (lo que Auth0 llama
 *      "automatic reuse detection").
 *
 *   3. revocar(plano) — al /logout. Marca como revocado.
 *
 *   4. revocarTodos(usuario) — al /revoke-all. Cierra todas las sesiones.
 *
 * El token plano NUNCA se guarda en BBDD — si la base se filtra, los
 * hashes no permiten reutilizar las sesiones existentes.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final int TOKEN_BYTES = 32; // 256 bits de entropía
    private static final SecureRandom RANDOM = new SecureRandom();
    // Audit P2 (2026-05-17): ventana de gracia para race entre pestañas.
    // Si el token revocado vuelve a presentarse en menos de N segundos,
    // probablemente es una segunda pestaña con el token viejo en flight
    // (cuya cookie aún no se ha actualizado tras la rotación de la primera).
    // En ese caso devolvemos empty SIN matar todas las sesiones — el cliente
    // reintentará con el cookie ya actualizado y obtendrá el token nuevo.
    // Más allá del grace, sigue siendo reuse genuino (token capturado).
    private static final long REUSE_GRACE_SECONDS = 10;

    private final RefreshTokenRepository repository;
    private final Duration ttl;

    public RefreshTokenService(
            RefreshTokenRepository repository,
            @Value("${app.refresh-token.ttl-days:30}") int ttlDias) {
        this.repository = repository;
        this.ttl = Duration.ofDays(ttlDias);
    }

    public Duration getTtl() {
        return ttl;
    }

    /**
     * Emite un nuevo refresh token y devuelve el VALOR PLANO. El caller
     * (AuthController) debe setear esto como cookie httpOnly al cliente
     * y nunca persistirlo en otra parte.
     */
    @Transactional
    public String emitir(Usuario usuario, String userAgent, String ipAddr) {
        String plano = generarTokenPlano();
        String hash = hashear(plano);
        LocalDateTime expira = LocalDateTime.now().plus(ttl);
        RefreshToken token = new RefreshToken(usuario, hash, expira, userAgent, ipAddr);
        repository.save(token);
        log.info("RefreshToken emitido: usuario={} expira={}", usuario.getUsername(), expira);
        return plano;
    }

    /**
     * Valida un refresh token plano del cliente y, si está activo, lo rota:
     * revoca el viejo + emite uno nuevo. Devuelve el nuevo plano + la
     * entidad Usuario para que el caller emita también un nuevo JWT.
     *
     * Si el token está REVOCADO (alguien lo reutiliza después de un refresh
     * previo), revocamos todas las sesiones del usuario como defensa contra
     * replay attack. El usuario tendrá que volver a hacer login.
     */
    /**
     * Resultado tipado de {@link #rotar}. Audit P1 (2026-05-17): antes
     * devolvía {@code Optional<RotarResultado>}, lo que forzaba al
     * controller a tratar igual "token inválido/expired" y "race
     * cross-tab dentro de grace". La diferencia importa: en el segundo
     * caso NO debemos limpiar la cookie, porque la primera pestaña ya
     * puso una nueva válida y el cliente espera mantenerla.
     */
    public sealed interface ResultadoRotacion {
        /** Rotación exitosa: nuevo refresh emitido. Caller setea cookie nueva. */
        record Ok(Usuario usuario, String nuevoTokenPlano) implements ResultadoRotacion {}
        /** Token viejo presentado dentro del grace cross-tab. Caller responde 401 SIN tocar la cookie. */
        record GraceCrossTab() implements ResultadoRotacion {}
        /** Token inválido/expired/reuse genuino. Caller responde 401 y limpia cookie. */
        record Invalido() implements ResultadoRotacion {}
    }

    @Transactional
    public ResultadoRotacion rotar(String plano, String userAgent, String ipAddr) {
        if (plano == null || plano.isBlank()) {
            return new ResultadoRotacion.Invalido();
        }
        String hash = hashear(plano);
        Optional<RefreshToken> opt = repository.findByTokenHash(hash);
        if (opt.isEmpty()) {
            log.warn("RefreshToken rotar: hash no encontrado (posible token forjado)");
            return new ResultadoRotacion.Invalido();
        }
        RefreshToken viejo = opt.get();

        // Detección de reuse: token revocado siendo presentado de nuevo.
        // Sintoma clásico de compromise — alguien capturó el token después
        // de su rotación. Mata todas las sesiones del usuario.
        //
        // EXCEPCIÓN: ventana de gracia REUSE_GRACE_SECONDS para race entre
        // pestañas. Si dos tabs refrescan a la vez con el mismo token
        // viejo, la primera lo rota y la segunda lo presenta milisegundos
        // después con el cookie aún sin actualizar. Sin esto, ambas tabs
        // se quedaban sin sesión en cada navegación simultánea.
        if (viejo.getRevocadoEn() != null) {
            long segundosDesdeRevoke = Duration.between(viejo.getRevocadoEn(), LocalDateTime.now()).getSeconds();
            if (segundosDesdeRevoke <= REUSE_GRACE_SECONDS) {
                log.info("RefreshToken race entre pestañas (revocado hace {}s, dentro de grace) — sin escalada",
                        segundosDesdeRevoke);
                return new ResultadoRotacion.GraceCrossTab();
            }
            int revocadas = repository.revocarTodosDelUsuario(viejo.getUsuario(), LocalDateTime.now());
            log.warn("RefreshToken REUSE detectado para usuario={} (revocado hace {}s), revocadas todas las sesiones ({})",
                    viejo.getUsuario().getUsername(), segundosDesdeRevoke, revocadas);
            return new ResultadoRotacion.Invalido();
        }

        if (viejo.getExpiraEn().isBefore(LocalDateTime.now())) {
            log.info("RefreshToken expirado para usuario={}", viejo.getUsuario().getUsername());
            return new ResultadoRotacion.Invalido();
        }

        viejo.revocar();
        repository.save(viejo);

        String nuevoPlano = emitir(viejo.getUsuario(), userAgent, ipAddr);
        return new ResultadoRotacion.Ok(viejo.getUsuario(), nuevoPlano);
    }

    /** Revoca específicamente el token que el cliente presenta (logout). */
    @Transactional
    public void revocar(String plano) {
        if (plano == null || plano.isBlank()) return;
        String hash = hashear(plano);
        repository.findByTokenHash(hash).ifPresent(t -> {
            if (t.getRevocadoEn() == null) {
                t.revocar();
                repository.save(t);
                log.info("RefreshToken revocado: usuario={}", t.getUsuario().getUsername());
            }
        });
    }

    /** Cierra todas las sesiones del usuario (revoke-all + cambio password). */
    @Transactional
    public int revocarTodos(Usuario usuario) {
        int n = repository.revocarTodosDelUsuario(usuario, LocalDateTime.now());
        log.info("RefreshToken revoke-all usuario={}: {} sesiones cerradas", usuario.getUsername(), n);
        return n;
    }

    // --- helpers ---

    private static String generarTokenPlano() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hashear(String plano) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] hash = sha256.digest(plano.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            // SHA-256 viene en cada JDK estándar; este catch solo existe por
            // la firma checked de getInstance.
            throw new IllegalStateException("SHA-256 no disponible en el JDK", e);
        }
    }

}
