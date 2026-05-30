package com.diegoalegil.animeshowdown.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.Cookie;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.util.Base64;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

class HttpCookieOAuth2AuthorizationRequestRepositoryTest {

    private HttpCookieOAuth2AuthorizationRequestRepository repo;

    @BeforeEach
    void setUp() {
        repo = new HttpCookieOAuth2AuthorizationRequestRepository();
        PocGadget.EXECUTED.set(false);
    }

    /**
     * R2-1: una cookie con un objeto Java serializado arbitrario NO debe
     * deserializarse. {@link PocGadget} tiene un {@code readObject()} que
     * marca un flag; si el repo usara ObjectInputStream ese readObject se
     * ejecutaría (instanciación arbitraria → RCE/DoS vía gadget chains) ANTES
     * del cast. Con la deserialización JSON el blob ni se interpreta (no es
     * JSON válido) → el flag queda en false y no se ejecuta nada.
     */
    @Test
    void cookieConObjetoJavaSerializadoNoEjecutaDeserializacion() throws Exception {
        String cookieMaliciosa = base64Url(serializarJava(new PocGadget()));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("oauth2_auth_request", cookieMaliciosa));

        OAuth2AuthorizationRequest result = repo.loadAuthorizationRequest(request);

        assertThat(PocGadget.EXECUTED.get())
                .as("una cookie con un objeto Java serializado NO debe deserializarse (RCE/DoS)")
                .isFalse();
        assertThat(result).isNull();
    }

    /** El flujo legítimo sigue funcionando: save → load round-trip por JSON. */
    @Test
    void roundTripDeUnaAuthRequestLegitima() {
        OAuth2AuthorizationRequest original = OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("client-123")
                .redirectUri("https://animeshowdown.dev/login/oauth2/code/google")
                .scopes(Set.of("openid", "email"))
                .state("estado-csrf-xyz")
                .build();

        MockHttpServletResponse response = new MockHttpServletResponse();
        repo.saveAuthorizationRequest(original, new MockHttpServletRequest(), response);
        String cookieValue = extraerSetCookie(response, "oauth2_auth_request");
        assertThat(cookieValue).isNotBlank();

        MockHttpServletRequest siguiente = new MockHttpServletRequest();
        siguiente.setCookies(new Cookie("oauth2_auth_request", cookieValue));
        OAuth2AuthorizationRequest cargada = repo.loadAuthorizationRequest(siguiente);

        assertThat(cargada).isNotNull();
        assertThat(cargada.getState()).isEqualTo("estado-csrf-xyz");
        assertThat(cargada.getClientId()).isEqualTo("client-123");
        assertThat(cargada.getAuthorizationUri())
                .isEqualTo("https://accounts.google.com/o/oauth2/v2/auth");
        assertThat(cargada.getScopes()).containsExactlyInAnyOrder("openid", "email");
    }

    private static byte[] serializarJava(Serializable obj) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            oos.writeObject(obj);
        }
        return baos.toByteArray();
    }

    private static String base64Url(byte[] data) {
        return Base64.getUrlEncoder().encodeToString(data);
    }

    /** El repo añade la cookie como header crudo Set-Cookie (ResponseCookie). */
    private static String extraerSetCookie(MockHttpServletResponse response, String nombre) {
        String header = response.getHeader("Set-Cookie");
        if (header == null) {
            return null;
        }
        String prefijo = nombre + "=";
        int i = header.indexOf(prefijo);
        if (i < 0) {
            return null;
        }
        int start = i + prefijo.length();
        int end = header.indexOf(';', start);
        return end < 0 ? header.substring(start) : header.substring(start, end);
    }

    /** Gadget benigno: su readObject marca un flag para detectar deser Java. */
    static class PocGadget implements Serializable {
        private static final long serialVersionUID = 1L;
        static final AtomicBoolean EXECUTED = new AtomicBoolean(false);

        private void readObject(java.io.ObjectInputStream in) throws Exception {
            in.defaultReadObject();
            EXECUTED.set(true);
        }
    }
}
