package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.Usuario;

import dev.samstevens.totp.code.CodeGenerator;
import dev.samstevens.totp.code.CodeVerifier;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.DefaultCodeVerifier;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import dev.samstevens.totp.util.Utils;

/**
 * Wrapper sobre la lib dev.samstevens.totp para 2FA TOTP.
 *
 * <p>Encapsula:
 * <ul>
 *   <li>Generación de secrets base32 de 32 chars (entropía 160 bits).</li>
 *   <li>Construcción de la URI <code>otpauth://</code> que el QR codifica;
 *       la app del usuario (Google Authenticator, Authy, 1Password, etc.)
 *       la entiende y registra la cuenta.</li>
 *   <li>Generación del PNG del QR como <code>data:image/png;base64,...</code>
 *       para incrustar directamente en un &lt;img&gt; sin endpoint extra.</li>
 *   <li>Validación de códigos de 6 dígitos con drift configurable (1 step
 *       de 30s = el código actual y el adyacente cuentan, para tolerar
 *       relojes desincronizados).</li>
 * </ul>
 *
 * <p>El secret se pasa al método como string plano. La capa de
 * persistencia ({@link TotpEncryptor}) lo cifra antes de guardarlo y
 * descifra al leerlo. Este service NO toca BBDD.
 */
@Service
public class TotpService {

    private static final Logger log = LoggerFactory.getLogger(TotpService.class);

    /** Issuer que aparece en la app del usuario al añadir la cuenta. */
    private final String issuer;

    private final SecretGenerator secretGenerator;
    private final QrGenerator qrGenerator;
    private final CodeVerifier codeVerifier;
    private final CodeGenerator codeGenerator;
    private final TimeProvider timeProvider;

    public TotpService(@Value("${app.totp.issuer:AnimeShowdown}") String issuer) {
        this.issuer = issuer;
        this.secretGenerator = new DefaultSecretGenerator();
        this.qrGenerator = new ZxingPngQrGenerator();
        this.timeProvider = new SystemTimeProvider();
        this.codeGenerator = new DefaultCodeGenerator();
        DefaultCodeVerifier verifier = new DefaultCodeVerifier(codeGenerator, timeProvider);
        // Drift de 1 step (30s a cada lado). Tolera desincronización moderada
        // del reloj del móvil sin abrir una ventana grande a ataques de fuerza
        // bruta. Default de la lib es 0 — demasiado estricto para producción.
        verifier.setTimePeriod(30);
        verifier.setAllowedTimePeriodDiscrepancy(1);
        this.codeVerifier = verifier;
    }

    /** Genera un secret base32 nuevo. Listo para mostrar al usuario y cifrar al guardar. */
    public String generarSecret() {
        return secretGenerator.generate();
    }

    /**
     * Construye la URI otpauth:// que codificaremos al QR.
     * <pre>otpauth://totp/AnimeShowdown:usuario@correo.com?secret=XXX&issuer=AnimeShowdown</pre>
     */
    public String construirOtpauthUri(Usuario usuario, String secret) {
        QrData data = new QrData.Builder()
                .label(issuer + ":" + usuario.getEmail())
                .secret(secret)
                .issuer(issuer)
                .algorithm(dev.samstevens.totp.code.HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();
        return data.getUri();
    }

    /**
     * Genera el QR PNG como data URI base64.
     * Listo para colocar en <code>&lt;img src="..."&gt;</code> en el frontend
     * sin necesidad de exponer un endpoint /qr.png aparte.
     */
    public String generarQrDataUri(Usuario usuario, String secret) {
        QrData data = new QrData.Builder()
                .label(issuer + ":" + usuario.getEmail())
                .secret(secret)
                .issuer(issuer)
                .algorithm(dev.samstevens.totp.code.HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();
        try {
            byte[] png = qrGenerator.generate(data);
            return Utils.getDataUriForImage(png, qrGenerator.getImageMimeType());
        } catch (Exception e) {
            log.error("Error generando QR TOTP para usuario={}", usuario.getUsername(), e);
            throw new IllegalStateException("No se pudo generar el código QR", e);
        }
    }

    /**
     * Valida un código TOTP contra el secret.
     * @param secret  secret base32 en plaintext (ya descifrado).
     * @param codigo  código de 6 dígitos introducido por el usuario.
     * @return true si el código es válido (o cae dentro del drift permitido).
     */
    public boolean validarCodigo(String secret, String codigo) {
        if (secret == null || codigo == null) return false;
        String limpio = codigo.replaceAll("\\s+", "");
        if (limpio.length() != 6 || !limpio.matches("\\d{6}")) return false;
        return codeVerifier.isValidCode(secret, limpio);
    }

    /**
     * Como {@link #validarCodigo} pero devuelve el step de 30s al que
     * pertenece el código aceptado (o -1 si no valida). El caller persiste
     * ese step y rechaza códigos de steps ya consumidos: sin esto, un código
     * interceptado se puede reusar durante toda la ventana de drift (~90s).
     */
    public long validarCodigoStep(String secret, String codigo) {
        if (secret == null || codigo == null) return -1;
        String limpio = codigo.replaceAll("\\s+", "");
        if (limpio.length() != 6 || !limpio.matches("\\d{6}")) return -1;
        long stepActual = timeProvider.getTime() / 30;
        for (long s = stepActual + 1; s >= stepActual - 1; s--) {
            try {
                if (codeGenerator.generate(secret, s).equals(limpio)) {
                    return s;
                }
            } catch (Exception e) {
                log.error("Error generando código TOTP de comparación", e);
                return -1;
            }
        }
        return -1;
    }
}
