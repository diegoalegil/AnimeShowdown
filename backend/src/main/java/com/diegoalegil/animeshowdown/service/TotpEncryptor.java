package com.diegoalegil.animeshowdown.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.stereotype.Component;

/**
 * Cifrado simétrico AES para los secrets TOTP.
 *
 * <p>El secret TOTP debe poder leerse en plaintext para validar códigos
 * (no es un hash one-way como password). Si la BBDD se filtra con los
 * secrets en claro, todos los 2FA de la plataforma quedan inutilizados.
 * Cifrarlos con una clave que vive en el.env del backend (no en la BBDD)
 * hace que la fuga de BBDD sola no comprometa el 2FA.
 *
 * <p>Clave configurable vía env var <code>TOTP_ENCRYPTION_KEY</code>.
 * El salt es fijo (no es secreto, solo aleatoriza la derivación PBKDF2).
 * El IV es random por cada encrypt — el mismo plaintext produce
 * ciphertexts distintos pero todos descifran al mismo valor.
 *
 * <p><strong>Migración CBC → GCM (fase 1):</strong> se cifra con AES/GCM
 * autenticado ({@link Encryptors#delux}); el AES/CBC sin autenticar anterior
 * ({@link Encryptors#text}) se conserva SOLO como fallback de lectura para los
 * secretos guardados antes de la migración. Misma key+salt para ambos, así el
 * cambio no rompe a nadie: lo viejo descifra por CBC, lo nuevo por GCM. Tras
 * re-cifrar todo a GCM se retirará el fallback (fases 2/3).
 *
 * <p>El default es un placeholder ruidoso para que sea evidente si se
 * arranca prod sin override. En tests usamos una clave fija.
 */
@Component
public class TotpEncryptor {

    private static final Logger log = LoggerFactory.getLogger(TotpEncryptor.class);

    /** Cifrador nuevo: AES/GCM autenticado ({@link Encryptors#delux}). */
    private final TextEncryptor gcm;
    /**
     * Cifrador legacy: AES/CBC sin autenticación ({@link Encryptors#text}),
     * construido EXACTAMENTE como antes (misma key+salt) para descifrar los
     * secretos guardados antes de la migración. Solo se usa como fallback de
     * lectura; nunca se cifra con él. Se retirará cuando todos los secretos
     * estén re-cifrados a GCM (fases 2/3 de la migración).
     */
    private final TextEncryptor cbcLegacy;

    public TotpEncryptor(
            @Value("${app.totp.encryption-key:CHANGE_ME_IN_PROD_openssl_rand_base64_32}") String password,
            @Value("${app.totp.encryption-salt:5c0744940b5c369b}") String saltHex) {
        if ("CHANGE_ME_IN_PROD_openssl_rand_base64_32".equals(password)) {
            log.warn("TotpEncryptor arrancando con clave default — define TOTP_ENCRYPTION_KEY en producción");
        }
        this.gcm = Encryptors.delux(password, saltHex);
        this.cbcLegacy = Encryptors.text(password, saltHex);
    }

    /** Cifra con GCM (autenticado). Los secretos nuevos nacen ya en GCM. */
    public String cifrar(String plaintext) {
        if (plaintext == null) return null;
        return gcm.encrypt(plaintext);
    }

    /**
     * Descifra el secreto. Intenta GCM y, si falla, cae a CBC legacy (secretos
     * cifrados antes de la migración). La autenticación de GCM hace que un
     * ciphertext CBC alimentado a GCM falle de forma inequívoca (tag inválido),
     * así que el fallback es seguro y sin ambigüedad: nunca devuelve basura. Si
     * ambos esquemas fallan (ciphertext corrupto o clave cambiada) propaga el
     * error original de GCM.
     */
    public String descifrar(String ciphertext) {
        return descifrarConOrigen(ciphertext).plaintext();
    }

    /**
     * Resultado de descifrar: el {@code plaintext} y si vino de un ciphertext
     * CBC legacy ({@code legado=true}), señal para la migración perezosa
     * (fase 2): el llamante re-cifra a GCM y persiste tras una validación.
     */
    public record Descifrado(String plaintext, boolean legado) {}

    /**
     * Como {@link #descifrar}, pero además indica si el secreto estaba en CBC
     * legacy (se descifró por el fallback) — para que el flujo de validación lo
     * re-cifre a GCM de forma perezosa. Un GCM válido devuelve {@code legado=false};
     * el fallback CBC, {@code legado=true}; null entra y sale como null.
     */
    public Descifrado descifrarConOrigen(String ciphertext) {
        if (ciphertext == null) return new Descifrado(null, false);
        try {
            return new Descifrado(gcm.decrypt(ciphertext), false);
        } catch (RuntimeException errorGcm) {
            try {
                return new Descifrado(cbcLegacy.decrypt(ciphertext), true);
            } catch (RuntimeException errorCbc) {
                throw errorGcm;
            }
        }
    }
}
