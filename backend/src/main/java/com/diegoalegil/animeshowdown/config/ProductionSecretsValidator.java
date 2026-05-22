package com.diegoalegil.animeshowdown.config;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * Audit P3 (2026-05-17): impide arrancar en modo no-test si alguna de las
 * claves sensibles sigue con el placeholder {@code CHANGE_ME_IN_PROD...}.
 * Antes la app boot OK con defaults inseguros — el operador podía olvidar
 * configurar JWT_SECRET / TOTP_ENCRYPTION_KEY / DB_PASSWORD y descubrir
 * el agujero solo al primer ataque (JWT firmado con secret conocido,
 * TOTP codes generables sin tener acceso a backups, etc.).
 *
 * <p>Audit externo AS-057 (2026-05-22): el chequeo de prefijo era
 * {@code "CHANGE_ME_IN_PROD"} estricto y se saltaba secretos OAuth con
 * prefijos {@code CHANGE_ME_GOOGLE_*} / {@code CHANGE_ME_DISCORD_*}.
 * Ahora detecta cualquier valor que empieza por {@code "CHANGE_ME"} y
 * separa secretos REQUERIDOS (abortan boot) de OPCIONALES (warning):
 *
 * <ul>
 *   <li>REQUERIDOS: DB, JWT, TOTP — sin estos la app ES insegura.</li>
 *   <li>OPCIONALES: OAuth Google/Discord — si están con placeholder, los
 *       providers OAuth no funcionarán pero la app sigue siendo segura.
 *       Log warning para que el operador sepa antes del primer login.</li>
 * </ul>
 *
 * <p>Solo activo bajo {@code !test}: el profile de tests SÍ usa los
 * defaults para no requerir env vars en CI/local. Producción (Railway)
 * arranca sin profile o con {@code prod}; en ambos casos esta validación
 * se aplica.
 */
@Component
@Profile("!test")
public class ProductionSecretsValidator {

    private static final Logger log = LoggerFactory.getLogger(ProductionSecretsValidator.class);
    private static final String INSEGURO_PREFIJO = "CHANGE_ME";

    private final Map<String, String> secretosRequeridos;
    private final Map<String, String> secretosOpcionales;

    public ProductionSecretsValidator(
            @Value("${spring.datasource.password:}") String dbPassword,
            @Value("${jwt.secret:}") String jwtSecret,
            @Value("${app.totp.encryption-key:}") String totpKey,
            @Value("${spring.security.oauth2.client.registration.google.client-id:}") String googleClientId,
            @Value("${spring.security.oauth2.client.registration.google.client-secret:}") String googleClientSecret,
            @Value("${spring.security.oauth2.client.registration.discord.client-id:}") String discordClientId,
            @Value("${spring.security.oauth2.client.registration.discord.client-secret:}") String discordClientSecret) {
        // LinkedHashMap para que el mensaje de error sea determinístico
        // (Map.of no garantiza orden en versiones futuras).
        this.secretosRequeridos = new LinkedHashMap<>();
        this.secretosRequeridos.put("DB_PASSWORD (spring.datasource.password)", dbPassword);
        this.secretosRequeridos.put("JWT_SECRET (jwt.secret)", jwtSecret);
        this.secretosRequeridos.put("TOTP_ENCRYPTION_KEY (app.totp.encryption-key)", totpKey);

        this.secretosOpcionales = new LinkedHashMap<>();
        this.secretosOpcionales.put("GOOGLE_CLIENT_ID", googleClientId);
        this.secretosOpcionales.put("GOOGLE_CLIENT_SECRET", googleClientSecret);
        this.secretosOpcionales.put("DISCORD_CLIENT_ID", discordClientId);
        this.secretosOpcionales.put("DISCORD_CLIENT_SECRET", discordClientSecret);
    }

    @PostConstruct
    void validar() {
        List<String> requeridosInseguros = new ArrayList<>();
        for (Map.Entry<String, String> e : secretosRequeridos.entrySet()) {
            if (esInseguro(e.getValue())) {
                requeridosInseguros.add(e.getKey());
            }
        }
        if (!requeridosInseguros.isEmpty()) {
            String mensaje = "Boot abortado: las siguientes variables de entorno "
                    + "tienen el placeholder por defecto o están vacías: "
                    + requeridosInseguros
                    + ". Configúralas con valores reales antes de arrancar la app.";
            log.error(mensaje);
            throw new IllegalStateException(mensaje);
        }

        List<String> opcionalesInseguros = new ArrayList<>();
        for (Map.Entry<String, String> e : secretosOpcionales.entrySet()) {
            if (esInseguro(e.getValue())) {
                opcionalesInseguros.add(e.getKey());
            }
        }
        if (!opcionalesInseguros.isEmpty()) {
            log.warn(
                    "ProductionSecretsValidator: variables OAuth con placeholder o vacías {} — "
                            + "los login providers asociados no funcionarán hasta que se configuren.",
                    opcionalesInseguros);
        }

        log.info(
                "ProductionSecretsValidator: {} variables requeridas validadas, {} opcionales con placeholder.",
                secretosRequeridos.size(),
                opcionalesInseguros.size());
    }

    private static boolean esInseguro(String valor) {
        return valor == null || valor.isBlank() || valor.startsWith(INSEGURO_PREFIJO);
    }
}
