package com.diegoalegil.animeshowdown.security;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Base64;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.jackson2.SecurityJackson2Modules;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Guarda la OAuth2 authorization request en una cookie HttpOnly dedicada en
 * lugar de la HttpSession por defecto. Necesario porque Safari ITP descarta
 * agresivamente el JSESSIONID cuando el callback OAuth viene de un origin
 * externo (accounts.google.com → api.animeshowdown.dev), aunque la cookie
 * tenga SameSite=Lax + Secure. Resultado: Spring no encuentra la auth
 * request en la session y devuelve [authorization_request_not_found].
 *
 * Con una cookie dedicada de corta vida (3 min) que viaja con el callback,
 * el flow funciona en Safari, Chrome, Firefox y Brave por igual sin
 * depender del JSESSIONID.
 *
 * Seguridad del payload:
 * - Serialización JSON (Jackson con SecurityJackson2Modules: allowlist de
 *   tipos para el typing polimórfico) + Base64 URL-safe. NO se usa
 *   ObjectInputStream: era un sink de deserialización Java insegura sobre una
 *   cookie controlable por el cliente (RCE/DoS por gadget chains del
 *   classpath). No se encripta porque el cookie es HttpOnly (no accesible a
 *   JS) y la auth request en sí no contiene secretos del backend; el state
 *   aleatorio que viaja dentro ya protege contra CSRF.
 * - TTL 180s (cubre cualquier flow OAuth realista, incluido 2FA del usuario
 *   en Google/Discord; si caduca, el user inicia el flow otra vez).
 * - HttpOnly + Secure + SameSite=Lax: estándar para cookies de flow OAuth.
 */
@Component
public class HttpCookieOAuth2AuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final Logger log = LoggerFactory.getLogger(HttpCookieOAuth2AuthorizationRequestRepository.class);

    public static final String COOKIE_NAME = "oauth2_auth_request";
    private static final int COOKIE_TTL_SECONDS = 180;
    private static final String COOKIE_PATH = "/";

    /**
     * ObjectMapper con los módulos de Spring Security (allowlist de tipos para
     * el typing polimórfico) + el de OAuth2 client si está en el classpath.
     * Sustituye la serialización Java nativa por JSON restringido: la cookie
     * deja de pasar por ObjectInputStream (sink de RCE/DoS por gadget chains).
     */
    private static final ObjectMapper MAPPER = construirMapper();

    private static ObjectMapper construirMapper() {
        ObjectMapper mapper = new ObjectMapper();
        ClassLoader classLoader = HttpCookieOAuth2AuthorizationRequestRepository.class.getClassLoader();
        mapper.registerModules(SecurityJackson2Modules.getModules(classLoader));
        return mapper;
    }

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, COOKIE_NAME);
        if (cookie == null) {
            // Diagnóstico SIN enumerar nombres de cookies (no filtramos nombres de
            // cookies de sesión/terceros a los logs): el conteo basta para
            // distinguir "Safari las descartó todas" (0) de "solo la nuestra" (>0).
            int recibidas = request.getCookies() == null ? 0 : request.getCookies().length;
            log.warn("OAuth load: cookie '{}' NO presente en el request. {} cookie(s) recibida(s) en total.",
                    COOKIE_NAME, recibidas);
            return null;
        }
        log.debug("OAuth load: cookie '{}' recibida con {} chars", COOKIE_NAME, cookie.getValue().length());
        return deserialize(cookie.getValue());
    }

    @Override
    public void saveAuthorizationRequest(
            OAuth2AuthorizationRequest authorizationRequest,
            HttpServletRequest request,
            HttpServletResponse response) {
        if (authorizationRequest == null) {
            // Spring llama saveAuthorizationRequest(null) para limpiar; aprovecha
            // para borrar la cookie con maxAge=0.
            response.addHeader(HttpHeaders.SET_COOKIE, buildCookie("", 0).toString());
            return;
        }
        String encoded = serialize(authorizationRequest);
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(encoded, COOKIE_TTL_SECONDS).toString());
        log.info("OAuth save: cookie '{}' set con {} chars (provider={})",
                COOKIE_NAME, encoded.length(),
                authorizationRequest.getAttributes().get("registration_id"));
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(
            HttpServletRequest request,
            HttpServletResponse response) {
        OAuth2AuthorizationRequest authRequest = loadAuthorizationRequest(request);
        if (authRequest != null) {
            response.addHeader(HttpHeaders.SET_COOKIE, buildCookie("", 0).toString());
        }
        return authRequest;
    }

    private ResponseCookie buildCookie(String value, long maxAgeSeconds) {
        // SameSite=None + Secure es OBLIGATORIO para flows OAuth que cruzan
        // entre el provider (accounts.google.com, discord.com) y nuestro
        // backend. Safari ITP descarta la cookie con SameSite=Lax cuando
        // detecta la secuencia animeshowdown.dev → provider → api.animeshowdown.dev
        // aunque sea navegación top-level GET. El state OAuth aleatorio ya
        // protege contra CSRF, así que aflojar a None no introduce nuevo
        // riesgo. HttpOnly evita acceso desde JS y Secure exige HTTPS.
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .path(COOKIE_PATH)
                .maxAge(maxAgeSeconds)
                .build();
    }

    private static String serialize(OAuth2AuthorizationRequest authRequest) {
        try {
            byte[] json = MAPPER.writeValueAsBytes(authRequest);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(json);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize OAuth2AuthorizationRequest", e);
        }
    }

    private static OAuth2AuthorizationRequest deserialize(String encoded) {
        try {
            byte[] json = Base64.getUrlDecoder().decode(encoded);
            return MAPPER.readValue(json, OAuth2AuthorizationRequest.class);
        } catch (Exception e) {
            log.warn("OAuth2AuthorizationRequest cookie corrupta o no deserializable: {}", e.getMessage());
            return null;
        }
    }
}
