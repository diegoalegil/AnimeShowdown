package com.diegoalegil.animeshowdown.service;

import java.security.SecureRandom;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.ReferralStatsDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Sistema de referrals.
 *
 * <ul>
 *   <li>Cada usuario tiene un {@code referral_code} único de 8 chars,
 *       generado en el registro. Si choca con uno existente (1 entre
 *       2.8·10¹², casi imposible) reintenta hasta 5 veces.</li>
 *   <li>Otro usuario puede registrarse con {@code referralCode=XXX} y
 *       quedar enganchado como referido del owner del código.</li>
 *   <li>El badge {@code reclutador} (catálogo V7) se desbloquea al
 *       acumular {@value #UMBRAL_RECLUTADOR} referidos verificados.</li>
 * </ul>
 *
 * <p>Solo cuentan referidos {@code ACTIVO} (email verificado) para evitar
 * spam con cuentas fake. La verificación dispara la re-evaluación del
 * badge en el listener correspondiente — aquí solo exponemos el count.
 */
@Service
public class ReferralService {

    private static final Logger log = LoggerFactory.getLogger(ReferralService.class);
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final int MAX_INTENTOS_GENERACION = 5;
    public static final int UMBRAL_RECLUTADOR = 5;

    private final UsuarioRepository usuarioRepository;
    private final SecureRandom random = new SecureRandom();

    public ReferralService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    /**
     * Genera y asigna un código único al usuario si todavía no tenía uno.
     * Idempotente — no hace nada si ya tiene código. No persiste; el caller
     * decide cuándo guardar (en el flow de registro, justo antes del save).
     */
    public void asignarCodigoSiHaceFalta(Usuario u) {
        if (u.getReferralCode() != null && !u.getReferralCode().isBlank()) return;
        for (int i = 0; i < MAX_INTENTOS_GENERACION; i++) {
            String candidato = generarCodigo();
            if (usuarioRepository.findByReferralCode(candidato).isEmpty()) {
                u.setReferralCode(candidato);
                return;
            }
        }
        // Si tras 5 intentos no encontramos único, dejamos null. El backfill
        // o el siguiente flow lo reintentará. No es crítico para el registro.
        log.warn("ReferralService: no se pudo generar código único para usuario={}",
                u.getUsername());
    }

    /**
     * Persiste al usuario tolerando la rarísima carrera del código referral.
     * {@link #asignarCodigoSiHaceFalta} hace check-then-act sin lock: dos
     * registros concurrentes podrían generar el mismo código (espacio 32^8 ≈
     * 1.1·10¹², colisión ~imposible), ambos pasar el chequeo y uno colisionar al
     * persistir contra el UNIQUE constraint. La unicidad la arbitra la BD, no la
     * lectura previa; aquí, en vez de tumbar el registro con un 500, degradamos a
     * sin-código (el backfill lo asigna luego). Una colisión de OTRO constraint
     * (username/email) se propaga intacta.
     *
     * <p>Seguro SOLO en contexto NO transaccional: con id {@code IDENTITY} un
     * INSERT fallido deja el id null, así el segundo save es un INSERT limpio que
     * no duplica la fila. No usar dentro de una @Transactional (el DIV marcaría
     * la tx rollback-only y el segundo save fallaría).
     */
    public Usuario guardarTolerandoColisionReferral(Usuario u) {
        try {
            return usuarioRepository.save(u);
        } catch (DataIntegrityViolationException e) {
            if (u.getReferralCode() == null || u.getReferralCode().isBlank()) {
                throw e; // la colisión no era del código referral → propaga
            }
            log.warn("Colisión de referral code en carrera; guardo sin código (backfill lo asignará): {}",
                    e.getMessage());
            u.setReferralCode(null);
            return usuarioRepository.save(u);
        }
    }

    /**
     * Busca el usuario referrer si el código existe. Devuelve empty si
     * el código no se reconoce — el registro continúa sin vínculo.
     */
    @Transactional(readOnly = true)
    public Optional<Usuario> resolverReferrer(String codigo) {
        if (codigo == null || codigo.isBlank()) return Optional.empty();
        String norm = codigo.trim().toUpperCase();
        return usuarioRepository.findByReferralCode(norm);
    }

    /**
     * Stats del usuario actual para la UI: código, count de referidos
     * verificados y si ya ha alcanzado el tier de badge.
     */
    @Transactional(readOnly = true)
    public ReferralStatsDto stats(Usuario u) {
        long count = usuarioRepository.countReferidosVerificadosByReferrerId(u.getId());
        return new ReferralStatsDto(
                u.getReferralCode(),
                count,
                UMBRAL_RECLUTADOR,
                count >= UMBRAL_RECLUTADOR);
    }

    /**
     * Backfill al boot: para cada usuario sin código, intenta asignar uno.
     * Best-effort; se ejecuta una vez por boot (asíncrono no necesario, son
     * decenas de filas como mucho hasta que la migración baja todo a 0).
     */
    @Transactional
    public int backfillCodigos() {
        List<Usuario> sinCodigo = usuarioRepository.findByReferralCodeIsNull();
        if (sinCodigo.isEmpty()) return 0;
        int asignados = 0;
        for (Usuario u : sinCodigo) {
            asignarCodigoSiHaceFalta(u);
            if (u.getReferralCode() == null) continue;
            try {
                usuarioRepository.save(u);
                asignados++;
            } catch (DataIntegrityViolationException e) {
                log.warn("Backfill referral code colisión para usuario={}: {}",
                        u.getUsername(), e.getMessage());
            }
        }
        log.info("ReferralService backfill: {} códigos asignados", asignados);
        return asignados;
    }

    private String generarCodigo() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
