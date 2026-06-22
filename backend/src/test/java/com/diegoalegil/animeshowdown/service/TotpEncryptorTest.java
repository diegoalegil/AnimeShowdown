package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.encrypt.Encryptors;

/**
 * Migración CBC → GCM (fase 1): los secretos nuevos se cifran con GCM y los
 * legacy (AES/CBC, anteriores a la migración) siguen descifrándose vía el
 * fallback, con la misma key+salt. Tests sin contexto Spring: construyen el
 * encryptor directamente con una key/salt fija de prueba.
 */
class TotpEncryptorTest {

    private static final String KEY = "clave-totp-de-prueba-no-secreta";
    private static final String SALT = "5c0744940b5c369b"; // 16 hex chars

    @Test
    void cifraConGcmYDescifraDeVuelta() {
        TotpEncryptor enc = new TotpEncryptor(KEY, SALT);
        String secreto = "JBSWY3DPEHPK3PXP";

        String cifrado = enc.cifrar(secreto);

        assertThat(cifrado).isNotNull().isNotEqualTo(secreto);
        assertThat(enc.descifrar(cifrado)).isEqualTo(secreto);
    }

    @Test
    void descifraSecretosLegacyCifradosConCbc() {
        // Secreto cifrado con el esquema ANTERIOR (Encryptors.text = AES/CBC) y
        // la MISMA key/salt: el fallback de descifrar debe recuperarlo, así
        // ningún usuario con 2FA previo a la migración queda bloqueado.
        String secreto = "KRSXG5CTMVRXEZLU";
        String legacyCbc = Encryptors.text(KEY, SALT).encrypt(secreto);

        TotpEncryptor enc = new TotpEncryptor(KEY, SALT);

        assertThat(enc.descifrar(legacyCbc)).isEqualTo(secreto);
    }

    @Test
    void cifrarProduceGcmNoCbc() {
        // El ciphertext de cifrar() se descifra con un lector GCM puro (delux),
        // confirmando que los secretos nuevos nacen en GCM, no en CBC.
        TotpEncryptor enc = new TotpEncryptor(KEY, SALT);
        String secreto = "MFRGGZDFMZTWQ2LK";

        String cifrado = enc.cifrar(secreto);

        assertThat(Encryptors.delux(KEY, SALT).decrypt(cifrado)).isEqualTo(secreto);
    }

    @Test
    void devuelveNullConEntradaNull() {
        TotpEncryptor enc = new TotpEncryptor(KEY, SALT);

        assertThat(enc.cifrar(null)).isNull();
        assertThat(enc.descifrar(null)).isNull();
    }
}
