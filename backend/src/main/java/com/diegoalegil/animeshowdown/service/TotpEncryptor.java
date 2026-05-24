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
 * <p>El default es un placeholder ruidoso para que sea evidente si se
 * arranca prod sin override. En tests usamos una clave fija.
 */
@Component
public class TotpEncryptor {

    private static final Logger log = LoggerFactory.getLogger(TotpEncryptor.class);

    private final TextEncryptor encryptor;

    public TotpEncryptor(
            @Value("${app.totp.encryption-key:CHANGE_ME_IN_PROD_openssl_rand_base64_32}") String password,
            @Value("${app.totp.encryption-salt:5c0744940b5c369b}") String saltHex) {
        if ("CHANGE_ME_IN_PROD_openssl_rand_base64_32".equals(password)) {
            log.warn("TotpEncryptor arrancando con clave default — define TOTP_ENCRYPTION_KEY en producción");
        }
        this.encryptor = Encryptors.text(password, saltHex);
    }

    public String cifrar(String plaintext) {
        if (plaintext == null) return null;
        return encryptor.encrypt(plaintext);
    }

    public String descifrar(String ciphertext) {
        if (ciphertext == null) return null;
        return encryptor.decrypt(ciphertext);
    }
}
