package com.diegoalegil.animeshowdown.security;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Lista de emails autorizados para auto-promoción a ADMIN tras verificar
 * email.
 *
 * <p>Configurado vía env var {@code ADMIN_EMAILS} (CSV). <b>Sin default
 * público</b>: si la env var no está definida, el set queda vacío y NO
 * se promociona a nadie. Antes había un default con el email del owner
 * hardcoded en el código — un atacante podría tomar admin en una BBDD
 * nueva registrando ese email antes que el owner.
 *
 * <p>La promoción ocurre en {@link com.diegoalegil.animeshowdown.service.EmailVerificationService}
 * tras confirmar email (no en el registro), así que necesita acceso al
 * inbox real. Defensa en profundidad.
 */
@Component
public class AdminEmails {

    private static final Logger log = LoggerFactory.getLogger(AdminEmails.class);

    private final Set<String> emails;

    public AdminEmails(@Value("${admin.emails:}") String csv) {
        Set<String> parsed = Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toCollection(HashSet::new));
        this.emails = Collections.unmodifiableSet(parsed);
        log.info("AdminEmails inicializado con {} email(s) configurado(s) vía ADMIN_EMAILS",
                this.emails.size());
    }

    /** True si el email (normalizado a lowercase) está en la lista de admins. */
    public boolean contains(String email) {
        if (email == null) return false;
        return emails.contains(email.trim().toLowerCase());
    }

    public int size() {
        return emails.size();
    }
}
