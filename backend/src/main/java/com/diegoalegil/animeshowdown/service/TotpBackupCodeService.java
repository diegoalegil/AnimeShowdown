package com.diegoalegil.animeshowdown.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.TotpBackupCode;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.TotpBackupCodeRepository;

/**
 * Gestión de backup codes del 2FA TOTP (Plan v2 §2.3).
 *
 * <p>Cada backup code es una cadena de 10 caracteres alfanuméricos en
 * mayúsculas (sin caracteres ambiguos como 0/O, 1/I/L) — fácil de copiar
 * a mano sin errores. Se generan en lotes de {@link #CANTIDAD_POR_LOTE}
 * y se le entregan al usuario UNA vez en plaintext. En BBDD solo viven
 * hasheados con BCrypt.
 *
 * <p>El consumo es one-shot: cuando un código matchea, se marca usadoEn
 * y deja de servir. Para validar contra el código que envía el cliente
 * hay que iterar los códigos no usados del usuario (no se puede indexar
 * por hash BCrypt porque cada uno tiene salt distinto).
 */
@Service
public class TotpBackupCodeService {

    private static final Logger log = LoggerFactory.getLogger(TotpBackupCodeService.class);

    /** Cantidad de códigos generados por set. 10 es el estándar (Google, GitHub, etc). */
    public static final int CANTIDAD_POR_LOTE = 10;

    /** Longitud de cada código. 10 chars × 32 alfabeto = 50 bits entropía — suficiente. */
    private static final int LONGITUD_CODIGO = 10;

    /**
     * Alfabeto sin caracteres visualmente ambiguos: sin 0/O, 1/I/L. El user
     * copia los códigos a papel/password manager, quitar confusiones reduce
     * errores de transcripción.
     */
    private static final char[] ALFABETO =
            "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();

    private final SecureRandom random = new SecureRandom();
    private final TotpBackupCodeRepository repo;
    private final PasswordEncoder passwordEncoder;

    public TotpBackupCodeService(TotpBackupCodeRepository repo, PasswordEncoder passwordEncoder) {
        this.repo = repo;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Genera un lote nuevo, lo persiste hasheado y devuelve los códigos en
     * plaintext UNA vez. El caller (controller) debe devolverlos al cliente
     * inmediatamente — después de esta llamada no son recuperables.
     *
     * <p>Si el usuario ya tiene códigos previos, los BORRA antes de generar
     * el set nuevo (regeneración). Esto invalida los códigos antiguos.
     */
    @Transactional
    public List<String> regenerar(Usuario usuario) {
        int borrados = repo.deleteByUsuario(usuario);
        if (borrados > 0) {
            log.info("Backup codes invalidados (regeneración): usuario={} borrados={}",
                    usuario.getUsername(), borrados);
        }
        List<String> plaintexts = new ArrayList<>(CANTIDAD_POR_LOTE);
        for (int i = 0; i < CANTIDAD_POR_LOTE; i++) {
            String plain = generarCodigo();
            String hash = passwordEncoder.encode(plain);
            repo.save(new TotpBackupCode(usuario, hash));
            plaintexts.add(plain);
        }
        log.info("Backup codes generados: usuario={} cantidad={}", usuario.getUsername(), CANTIDAD_POR_LOTE);
        return plaintexts;
    }

    /**
     * Borra TODOS los backup codes del usuario. Se llama al desactivar 2FA
     * completamente (junto con el clear del secret TOTP).
     */
    @Transactional
    public int eliminarTodos(Usuario usuario) {
        return repo.deleteByUsuario(usuario);
    }

    /**
     * Intenta consumir un código contra los backup codes del usuario.
     * Si encuentra match, marca el código como usado y devuelve true.
     * Si no encuentra, devuelve false sin tocar BBDD.
     *
     * <p>Iteración necesaria porque BCrypt usa salt aleatorio — no se puede
     * indexar por hash. 10 códigos × ~100ms cada uno = ~1s en el peor caso,
     * aceptable para un endpoint de recovery (no es hot path).
     */
    @Transactional
    public boolean consumirSiCoincide(Usuario usuario, String codigoPlano) {
        if (codigoPlano == null) return false;
        String normalizado = codigoPlano.trim().toUpperCase().replace("-", "").replace(" ", "");
        if (normalizado.length() != LONGITUD_CODIGO) return false;
        List<TotpBackupCode> noUsados = repo.findByUsuarioAndUsadoEnIsNull(usuario);
        Optional<TotpBackupCode> match = noUsados.stream()
                .filter(c -> passwordEncoder.matches(normalizado, c.getCodigoHash()))
                .findFirst();
        if (match.isEmpty()) return false;
        TotpBackupCode codigo = match.get();
        codigo.setUsadoEn(LocalDateTime.now());
        repo.save(codigo);
        long restantes = repo.countByUsuarioAndUsadoEnIsNull(usuario);
        log.info("Backup code consumido: usuario={} restantes={}", usuario.getUsername(), restantes);
        return true;
    }

    public long contarNoUsados(Usuario usuario) {
        return repo.countByUsuarioAndUsadoEnIsNull(usuario);
    }

    private String generarCodigo() {
        char[] buffer = new char[LONGITUD_CODIGO];
        for (int i = 0; i < LONGITUD_CODIGO; i++) {
            buffer[i] = ALFABETO[random.nextInt(ALFABETO.length)];
        }
        return new String(buffer);
    }
}
