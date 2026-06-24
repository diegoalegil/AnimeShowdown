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
 * impide arrancar en modo no-test si alguna de las
 * claves sensibles sigue con el placeholder {@code CHANGE_ME_IN_PROD...}.
 * Antes la app boot OK con defaults inseguros — el operador podía olvidar
 * configurar JWT_SECRET / TOTP_ENCRYPTION_KEY / DB_PASSWORD y descubrir
 * el agujero solo al primer ataque (JWT firmado con secret conocido,
 * TOTP codes generables sin tener acceso a backups, etc.).
 *
 * <p>el chequeo de prefijo era
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
    private final boolean turnstileEnabled;
    private final String turnstileSecret;
    /** Secreto del token de ronda ELO: opcional, su ausencia solo degrada (clave efímera). */
    private final String eloDuelTokenSecret;
    /** Con APP_SECRETS_STRICT=true las claves cortas abortan el boot (activar tras rotarlas). */
    private final boolean entropiaEstricta;
    /** ¿Hay API key de Resend? Sin ella el email transaccional está apagado. */
    private final boolean emailHabilitado;
    /** ¿El remitente sigue siendo el sender de prueba de Resend (solo entrega al dueño)? */
    private final boolean emailRemitenteEsTest;

    public ProductionSecretsValidator(
            @Value("${app.secrets.strict:false}") boolean entropiaEstricta,
            @Value("${spring.datasource.password:}") String dbPassword,
            @Value("${jwt.secret:}") String jwtSecret,
            @Value("${app.totp.encryption-key:}") String totpKey,
            @Value("${app.anon-identity.hmac-key:}") String anonIdentityHmacKey,
            @Value("${spring.security.oauth2.client.registration.google.client-id:}") String googleClientId,
            @Value("${spring.security.oauth2.client.registration.google.client-secret:}") String googleClientSecret,
            @Value("${spring.security.oauth2.client.registration.discord.client-id:}") String discordClientId,
            @Value("${spring.security.oauth2.client.registration.discord.client-secret:}") String discordClientSecret,
            @Value("${app.turnstile.enabled:false}") boolean turnstileEnabled,
            @Value("${app.turnstile.secret:}") String turnstileSecret,
            @Value("${app.elo-duel.token-secret:}") String eloDuelTokenSecret,
            @Value("${email.resend.api-key:}") String resendApiKey,
            @Value("${email.resend.from:}") String resendFrom) {
        // LinkedHashMap para que el mensaje de error sea determinístico
        // (Map.of no garantiza orden en versiones futuras).
        this.secretosRequeridos = new LinkedHashMap<>();
        this.secretosRequeridos.put("DB_PASSWORD (spring.datasource.password)", dbPassword);
        this.secretosRequeridos.put("JWT_SECRET (jwt.secret)", jwtSecret);
        this.secretosRequeridos.put("TOTP_ENCRYPTION_KEY (app.totp.encryption-key)", totpKey);
        // la cookie anónima firmada HMAC
        // requiere una clave secreta — sin ella el voto invitado no tiene
        // identidad estable server-side.
        this.secretosRequeridos.put(
                "ANON_IDENTITY_HMAC_KEY (app.anon-identity.hmac-key)", anonIdentityHmacKey);

        this.secretosOpcionales = new LinkedHashMap<>();
        this.secretosOpcionales.put("GOOGLE_CLIENT_ID", googleClientId);
        this.secretosOpcionales.put("GOOGLE_CLIENT_SECRET", googleClientSecret);
        this.secretosOpcionales.put("DISCORD_CLIENT_ID", discordClientId);
        this.secretosOpcionales.put("DISCORD_CLIENT_SECRET", discordClientSecret);

        this.turnstileEnabled = turnstileEnabled;
        this.turnstileSecret = turnstileSecret == null ? "" : turnstileSecret.trim();
        this.eloDuelTokenSecret = eloDuelTokenSecret == null ? "" : eloDuelTokenSecret.trim();
        this.entropiaEstricta = entropiaEstricta;

        this.emailHabilitado = resendApiKey != null && !resendApiKey.isBlank();
        // El default de email.resend.from es el sender de prueba de Resend, que
        // SOLO entrega al dueño de la cuenta. Si en prod sigue así (o vacío), los
        // usuarios reales no reciben verificación ni reset.
        String from = resendFrom == null ? "" : resendFrom.trim();
        this.emailRemitenteEsTest = from.isBlank() || from.equalsIgnoreCase("onboarding@resend.dev");
    }

    @PostConstruct
    void validar() {
        List<String> requeridosInseguros = new ArrayList<>();
        for (Map.Entry<String, String> e : secretosRequeridos.entrySet()) {
            if (esInseguro(e.getValue())) {
                requeridosInseguros.add(e.getKey());
            }
        }
        // si Turnstile está enabled, su
        // secret pasa de opcional a REQUERIDO. Aborto explícito antes que un
        // captcha que falla silenciosamente porque el secret vacío hace que
        // toda verificación rechace, dejando al usuario imposible de votar.
        if (turnstileEnabled && esInseguro(turnstileSecret)) {
            requeridosInseguros.add(
                    "TURNSTILE_SECRET (app.turnstile.secret, requerido cuando app.turnstile.enabled=true)");
        }
        if (!requeridosInseguros.isEmpty()) {
            String mensaje = "Boot abortado: las siguientes variables de entorno "
                    + "tienen el placeholder por defecto o están vacías: "
                    + requeridosInseguros
                    + ". Configúralas con valores reales antes de arrancar la app.";
            log.error(mensaje);
            throw new IllegalStateException(mensaje);
        }

        // Piso de entropía para las claves criptográficas: con menos de 32
        // chars un HMAC/JWT secret es fuerza-brutable offline. La password de
        // BBDD queda fuera (la gestiona el proveedor y viaja por TLS).
        List<String> criptoCortos = new ArrayList<>();
        for (Map.Entry<String, String> e : secretosRequeridos.entrySet()) {
            if (e.getKey().startsWith("DB_PASSWORD")) continue;
            String valor = e.getValue();
            if (valor != null && !valor.isBlank() && valor.trim().length() < 32) {
                criptoCortos.add(e.getKey());
            }
        }
        if (!criptoCortos.isEmpty()) {
            String mensaje = "Claves criptográficas demasiado cortas (mínimo 32 chars): "
                    + criptoCortos + ". Rota estos secretos con `openssl rand -base64 48`.";
            if (entropiaEstricta) {
                throw new IllegalStateException("Boot abortado: " + mensaje);
            }
            // Modo laxo (default): no podemos garantizar la longitud de los
            // secretos ya desplegados y un boot-abort sorpresa en prod es
            // peor que la debilidad. Tras rotar, fijar APP_SECRETS_STRICT=true.
            log.error(mensaje);
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

        // Email transaccional (verificación de cuenta + reset de contraseña). El
        // fallo era SILENCIOSO: sin RESEND_API_KEY el servicio está apagado y con
        // el RESEND_FROM de prueba Resend solo entrega al dueño de la cuenta, así
        // que los usuarios reales nunca reciben nada y no hay error visible. Lo
        // hacemos ruidoso en boot (y abortable con APP_SECRETS_STRICT, igual que
        // las claves cortas: un boot-abort sorpresa en prod sería peor que el
        // degradado, así que por defecto solo se avisa).
        List<String> emailProblemas = new ArrayList<>();
        if (!emailHabilitado) {
            emailProblemas.add("RESEND_API_KEY vacía (email transaccional DESACTIVADO)");
        }
        if (emailRemitenteEsTest) {
            emailProblemas.add("RESEND_FROM sin configurar — usa el sender de prueba "
                    + "onboarding@resend.dev, que SOLO entrega al dueño de la cuenta Resend");
        }
        if (!emailProblemas.isEmpty()) {
            String mensaje = "Configuración de email incompleta: " + emailProblemas
                    + ". La verificación de email y el reset de contraseña no llegarán a los "
                    + "usuarios reales. Configura RESEND_API_KEY y RESEND_FROM (dominio verificado).";
            if (entropiaEstricta) {
                throw new IllegalStateException("Boot abortado: " + mensaje);
            }
            log.error(mensaje);
        }

        // Token de ronda ELO: NO requerido (el fallback efímero es seguro, solo
        // pierde estabilidad entre redeploys/réplicas). Hard-fail sería dañino;
        // solo avisamos para que el operador lo cablee si quiere persistencia.
        if (eloDuelTokenSecret.isBlank()) {
            log.warn("ProductionSecretsValidator: app.elo-duel.token-secret (ELO_DUEL_TOKEN_SECRET) "
                    + "sin configurar — la clave del token de ronda ELO será efímera por instancia "
                    + "(los tokens en vuelo no sobreviven a un redeploy ni valen entre réplicas).");
        }

        log.info(
                "ProductionSecretsValidator: {} variables requeridas validadas, {} opcionales con placeholder. Turnstile enabled={}.",
                secretosRequeridos.size(),
                opcionalesInseguros.size(),
                turnstileEnabled);
    }

    private static boolean esInseguro(String valor) {
        return valor == null || valor.isBlank() || valor.startsWith(INSEGURO_PREFIJO);
    }
}
