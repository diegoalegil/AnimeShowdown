package com.diegoalegil.animeshowdown.security;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Audit externo AS-004 (2026-05-23): aplica umbrales antifraude sobre el
 * flujo de voto anónimo. Política aprobada por el revisor externo:
 *
 * <ul>
 *   <li>≤ 10 votos / hora por (anon_session_id ∪ ip_ua_hash) → ALLOW.</li>
 *   <li>10–29 votos / hora → REQUIRE_CAPTCHA. El cliente debe enviar
 *       un token Turnstile válido en X-AS-Captcha-Token para que el
 *       voto se acepte.</li>
 *   <li>≥ 30 votos / hora → SIEMPRE captcha, sin grace.</li>
 *   <li>≥ 100 votos / 24h por (session OR ip_ua_hash) → BLOCKED_24H.
 *       Ni captcha pasa. El cliente debe esperar Retry-After.</li>
 * </ul>
 *
 * <p>El servicio NO emite votos ni mantiene tablas separadas — cuenta
 * sobre la propia tabla votos via {@link VotoRepository} en ventanas
 * temporales. Eso evita una tabla "actividad" duplicada y mantiene la
 * fuente de verdad simple: si no hay voto registrado en BBDD, no
 * cuenta para abuso.
 *
 * <p>Trade-off conocido: usuarios legítimos en redes compartidas (NAT,
 * universidad, CGNAT móvil) comparten ip_ua_hash. El umbral de 10/h
 * está pensado para ser tolerante con ese caso. Si en producción
 * vemos falsos positivos, subir a 15/h se hace por env var, sin
 * redeploy de código.
 */
@Service
public class AnonymousAbuseThrottleService {

    private static final Logger log = LoggerFactory.getLogger(AnonymousAbuseThrottleService.class);

    public enum Decision {
        /** El voto puede registrarse sin fricción. */
        ALLOW,
        /** Se requiere un token Turnstile válido para que el voto pase. */
        REQUIRE_CAPTCHA,
        /** Cuota de 24h excedida; bloqueo temporal. */
        BLOCKED_24H,
    }

    private final VotoRepository votoRepository;
    private final Clock clock;
    private final int umbralSoftPorHora;
    private final int umbralHardPorHora;
    private final int umbralBloqueo24h;

    public AnonymousAbuseThrottleService(
            VotoRepository votoRepository,
            Clock clock,
            @Value("${app.anon-abuse.soft-per-hour:10}") int umbralSoftPorHora,
            @Value("${app.anon-abuse.hard-per-hour:30}") int umbralHardPorHora,
            @Value("${app.anon-abuse.block-per-24h:100}") int umbralBloqueo24h) {
        this.votoRepository = votoRepository;
        this.clock = clock;
        this.umbralSoftPorHora = umbralSoftPorHora;
        this.umbralHardPorHora = umbralHardPorHora;
        this.umbralBloqueo24h = umbralBloqueo24h;
    }

    /**
     * @param anonSessionId identidad anónima del cliente (cookie firmada
     *        post-AS-004 o header legacy).
     * @param ipUaHash hash determinístico de IP + User-Agent del cliente.
     *        Sirve como fingerprint server-side resistente a rotar la
     *        cookie. Puede ser null si el extractor falla — en ese caso
     *        solo se aplica el conteo por sesión.
     * @param captchaTokenValido si el cliente envió un token Turnstile y
     *        este ya fue validado con éxito en
     *        {@link TurnstileVerifierService#verify(String, String)},
     *        esta llamada puede ignorar la fricción de captcha (no
     *        ignora el bloqueo 24h — el captcha no perdona abuso real).
     */
    public Decision decide(String anonSessionId, String ipUaHash, boolean captchaTokenValido) {
        LocalDateTime ahora = LocalDateTime.now(clock);
        LocalDateTime hace1h = ahora.minus(Duration.ofHours(1));
        LocalDateTime hace24h = ahora.minus(Duration.ofHours(24));

        // 24h: bloqueo duro. Ni con captcha. Se cuenta el MÁXIMO entre
        // sesión e IP+UA — si alguien rota la cookie pero mantiene IP+UA,
        // queda capado igualmente.
        long votos24hSession = anonSessionId == null
                ? 0
                : votoRepository.countByAnonSessionIdAndFechaAfter(anonSessionId, hace24h);
        long votos24hIp = ipUaHash == null
                ? 0
                : votoRepository.countByAnonIpHashAndFechaAfter(ipUaHash, hace24h);
        long votos24h = Math.max(votos24hSession, votos24hIp);
        if (votos24h >= umbralBloqueo24h) {
            log.info(
                    "AnonymousAbuseThrottle: BLOCKED_24H sessionVotos={} ipVotos={} umbral={}",
                    votos24hSession,
                    votos24hIp,
                    umbralBloqueo24h);
            return Decision.BLOCKED_24H;
        }

        // 1h: dos umbrales — soft (captcha permite seguir) y hard
        // (captcha obligatorio).
        long votos1hSession = anonSessionId == null
                ? 0
                : votoRepository.countByAnonSessionIdAndFechaAfter(anonSessionId, hace1h);
        long votos1hIp = ipUaHash == null
                ? 0
                : votoRepository.countByAnonIpHashAndFechaAfter(ipUaHash, hace1h);
        long votos1h = Math.max(votos1hSession, votos1hIp);

        if (votos1h >= umbralHardPorHora) {
            // ≥ 30/h: captcha obligatorio. Si el cliente trae token
            // válido, permitimos. Si no, REQUIRE_CAPTCHA.
            if (captchaTokenValido) {
                log.debug(
                    "AnonymousAbuseThrottle: ALLOW con captcha (votos1h={} >= hard {})",
                    votos1h,
                    umbralHardPorHora);
                return Decision.ALLOW;
            }
            return Decision.REQUIRE_CAPTCHA;
        }
        if (votos1h >= umbralSoftPorHora) {
            // 10–29/h: captcha solo si el cliente todavía no lo presentó.
            if (captchaTokenValido) return Decision.ALLOW;
            return Decision.REQUIRE_CAPTCHA;
        }
        return Decision.ALLOW;
    }

    public int getUmbralSoftPorHora() {
        return umbralSoftPorHora;
    }

    public int getUmbralHardPorHora() {
        return umbralHardPorHora;
    }

    public int getUmbralBloqueo24h() {
        return umbralBloqueo24h;
    }
}
