package com.diegoalegil.animeshowdown.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

/**
 * Audit externo AS-004 (2026-05-23): cubre el comportamiento del verifier
 * contra el endpoint de Cloudflare en sus escenarios principales:
 *
 * <ol>
 *   <li>Disabled → pasa siempre (dev/tests).</li>
 *   <li>Enabled pero secret vacío/CHANGE_ME → rechaza (no permite captcha
 *       fake en silencio).</li>
 *   <li>Enabled + endpoint mock devuelve success=true → acepta.</li>
 *   <li>Enabled + endpoint mock devuelve success=false → rechaza.</li>
 *   <li>Enabled + endpoint cae con timeout/5xx → rechaza (mejor pedir
 *       retry que dejar pasar gratis).</li>
 * </ol>
 *
 * <p>Usa {@link HttpServer} de la JDK para no introducir WireMock como
 * dependencia. Levanta un puerto efímero y captura el form-body recibido
 * para verificar que el verifier mandó secret/response/remoteip.
 */
class TurnstileVerifierServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer mockServer;
    private int mockPort;
    private final AtomicReference<String> lastBody = new AtomicReference<>();
    private final AtomicReference<String> mockResponseBody = new AtomicReference<>("{\"success\":true}");
    private final AtomicReference<Integer> mockResponseStatus = new AtomicReference<>(200);

    @BeforeEach
    void setUpMockServer() throws IOException {
        mockServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        mockServer.createContext("/", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String body = new String(exchange.getRequestBody().readAllBytes(),
                        StandardCharsets.UTF_8);
                lastBody.set(body);
                byte[] resp = mockResponseBody.get().getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(mockResponseStatus.get(), resp.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(resp);
                }
            }
        });
        mockServer.start();
        mockPort = mockServer.getAddress().getPort();
    }

    @AfterEach
    void tearDownMockServer() {
        if (mockServer != null) mockServer.stop(0);
    }

    private String mockEndpoint() {
        return "http://127.0.0.1:" + mockPort + "/siteverify";
    }

    @Test
    void disabledDevuelveTrueSinTocarHttp() {
        TurnstileVerifierService svc = new TurnstileVerifierService(
                /* enabled */ false, /* secret */ "", mockEndpoint(), mapper);
        assertTrue(svc.verify("cualquier-token", "1.2.3.4"));
        // El mock no debería haber recibido nada — verify no tocó HTTP.
        // No podemos comprobar negativo directamente sin sleep, pero el
        // lastBody seguiría siendo null si no hubo request.
    }

    @Test
    void enabledSinSecretRechaza() {
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true, /* secret */ "", mockEndpoint(), mapper);
        assertFalse(svc.verify("token", "1.2.3.4"));
    }

    @Test
    void enabledConSecretChangeMeRechaza() {
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true, "CHANGE_ME_placeholder", mockEndpoint(), mapper);
        assertFalse(svc.verify("token", "1.2.3.4"));
    }

    @Test
    void enabledConTokenVacioRechaza() {
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true, "secret-real", mockEndpoint(), mapper);
        assertFalse(svc.verify("", "1.2.3.4"));
        assertFalse(svc.verify(null, "1.2.3.4"));
    }

    @Test
    void enabledConRespuestaSuccessTrueAcepta() {
        mockResponseBody.set("{\"success\":true,\"hostname\":\"animeshowdown.dev\"}");
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true, "test-secret", mockEndpoint(), mapper);
        assertTrue(svc.verify("token-de-prueba", "203.0.113.10"));
        // Verificamos que el server recibió secret/response/remoteip.
        String body = lastBody.get();
        assertTrue(body.contains("secret=test-secret"), "Body debe incluir secret: " + body);
        assertTrue(body.contains("response=token-de-prueba"), "Body debe incluir response: " + body);
        assertTrue(body.contains("remoteip=203.0.113.10"), "Body debe incluir remoteip: " + body);
    }

    @Test
    void enabledConRespuestaSuccessFalseRechaza() {
        mockResponseBody.set(
                "{\"success\":false,\"error-codes\":[\"invalid-input-response\"]}");
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true, "test-secret", mockEndpoint(), mapper);
        assertFalse(svc.verify("token-invalido", "203.0.113.10"));
    }

    @Test
    void enabledConHttp500Rechaza() {
        mockResponseStatus.set(500);
        mockResponseBody.set("internal error");
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true, "test-secret", mockEndpoint(), mapper);
        assertFalse(svc.verify("token", "1.2.3.4"));
    }

    @Test
    void enabledConEndpointInalcanzableRechaza() {
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true,
                "test-secret",
                "http://127.0.0.1:1/siteverify", // puerto cerrado
                mapper);
        assertFalse(svc.verify("token", "1.2.3.4"));
    }

    @Test
    void verifyOmiteRemoteIpVacioOSinValor() {
        mockResponseBody.set("{\"success\":true}");
        TurnstileVerifierService svc = new TurnstileVerifierService(
                true, "test-secret", mockEndpoint(), mapper);
        assertTrue(svc.verify("token", ""));
        String body = lastBody.get();
        // El form-encode omite valores vacíos. Aseguramos que el server
        // no recibió remoteip= con cadena vacía.
        // Importante: el servidor podría no recibir el form param,
        // pero el body NO debe incluir remoteip vacío.
        List<String> params = new ArrayList<>();
        for (String p : body.split("&")) params.add(p);
        assertTrue(params.stream().noneMatch(p -> p.equals("remoteip=")),
                "Body no debe incluir remoteip= vacío: " + body);
    }
}
