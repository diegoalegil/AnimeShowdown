package com.diegoalegil.animeshowdown.config;

import java.util.ArrayList;
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
 * <p>Solo activo bajo {@code !test}: el profile de tests SÍ usa los
 * defaults para no requerir env vars en CI/local. Producción (Railway)
 * arranca sin profile o con {@code prod}; en ambos casos esta validación
 * se aplica.
 */
@Component
@Profile("!test")
public class ProductionSecretsValidator {

    private static final Logger log = LoggerFactory.getLogger(ProductionSecretsValidator.class);
    private static final String INSEGURO_PREFIJO = "CHANGE_ME_IN_PROD";

    private final Map<String, String> secretos;

    public ProductionSecretsValidator(
            @Value("${spring.datasource.password:}") String dbPassword,
            @Value("${jwt.secret:}") String jwtSecret,
            @Value("${app.totp.encryption-key:}") String totpKey) {
        // Map ordenado para que el mensaje de error sea determinístico.
        this.secretos = Map.of(
                "DB_PASSWORD (spring.datasource.password)", dbPassword,
                "JWT_SECRET (jwt.secret)", jwtSecret,
                "TOTP_ENCRYPTION_KEY (app.totp.encryption-key)", totpKey);
    }

    @PostConstruct
    void validar() {
        List<String> inseguros = new ArrayList<>();
        for (Map.Entry<String, String> e : secretos.entrySet()) {
            String v = e.getValue();
            if (v == null || v.isBlank() || v.startsWith(INSEGURO_PREFIJO)) {
                inseguros.add(e.getKey());
            }
        }
        if (!inseguros.isEmpty()) {
            String mensaje = "Boot abortado: las siguientes variables de entorno "
                    + "tienen el placeholder por defecto o están vacías: "
                    + inseguros
                    + ". Configúralas con valores reales antes de arrancar la app.";
            log.error(mensaje);
            throw new IllegalStateException(mensaje);
        }
        log.info("ProductionSecretsValidator: las {} variables sensibles tienen valores configurados.",
                secretos.size());
    }
}
