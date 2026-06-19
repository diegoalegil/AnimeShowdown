package com.diegoalegil.animeshowdown.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.server.ResponseStatusException;

import com.auth0.jwt.exceptions.JWTVerificationException;

import jakarta.persistence.EntityNotFoundException;

/**
 * Blinda el shape estandarizado de {@code GlobalExceptionHandler} contra
 * regresiones.
 *
 * <p>El handler ya estaba estandarizado en main (todos los errores devuelven
 * {@code {timestamp, status, error, message, path}}); este test fija ese
 * contrato para que un cambio futuro no lo rompa silenciosamente. El frontend
 * (api.ts) depende de {@code body.message}, así que cada caso verifica que
 * ese campo está presente. El handler genérico además NO debe filtrar el
 * mensaje interno de la excepción (riesgo de leak de stack/info).
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private static MockHttpServletRequest req(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(uri);
        return request;
    }

    /** Toda respuesta de error comparte las 5 claves base + message no-blank. */
    private static void assertStandardShape(Map<String, Object> body, int status, String path) {
        assertThat(body).containsKeys("timestamp", "status", "error", "message", "path");
        assertThat(body.get("status")).isEqualTo(status);
        assertThat(body.get("path")).isEqualTo(path);
        assertThat(body.get("message")).asString().isNotBlank();
        assertThat(body.get("timestamp")).asString().isNotBlank();
    }

    @Test
    void notFoundDevuelve404ConShapeEstandar() {
        ResponseEntity<Map<String, Object>> resp = handler.handleNotFound(
                new EntityNotFoundException("Personaje no encontrado"), req("/api/personajes/999"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertStandardShape(resp.getBody(), 404, "/api/personajes/999");
        assertThat(resp.getBody().get("message")).isEqualTo("Personaje no encontrado");
    }

    @Test
    void dataIntegrityDevuelve409YnoFiltraLaCausaCruda() {
        ResponseEntity<Map<String, Object>> resp = handler.handleDataIntegrity(
                new DataIntegrityViolationException("duplicate key value violates unique constraint \"uk_secret\""),
                req("/api/torneos"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertStandardShape(resp.getBody(), 409, "/api/torneos");
        // El mensaje al cliente es genérico — no expone el nombre de la constraint.
        assertThat(resp.getBody().get("message").toString()).doesNotContain("uk_secret");
    }

    @Test
    void jwtInvalidoDevuelve401SinFiltrarDetalle() {
        ResponseEntity<Map<String, Object>> resp = handler.handleJwtVerification(
                new JWTVerificationException("signature verification failed for token abc.def.ghi"),
                req("/api/me"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertStandardShape(resp.getBody(), 401, "/api/me");
        // Mensaje genérico: no filtra el detalle interno del token al cliente.
        assertThat(resp.getBody().get("message").toString()).doesNotContain("abc.def.ghi");
    }

    @Test
    void malformedJsonDevuelve400() {
        ResponseEntity<Map<String, Object>> resp = handler.handleMalformedJson(
                new HttpMessageNotReadableException("bad json"), req("/api/votos"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertStandardShape(resp.getBody(), 400, "/api/votos");
    }

    @Test
    void badCredentialsDevuelve401() {
        ResponseEntity<Map<String, Object>> resp = handler.handleBadCredentials(
                new BadCredentialsException("Bad credentials"), req("/api/auth/login"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertStandardShape(resp.getBody(), 401, "/api/auth/login");
    }

    @Test
    void accessDeniedDevuelve403() {
        ResponseEntity<Map<String, Object>> resp = handler.handleAccessDenied(
                new AccessDeniedException("denied"), req("/api/admin/personajes/importar"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertStandardShape(resp.getBody(), 403, "/api/admin/personajes/importar");
    }

    @Test
    void illegalArgumentDevuelve400() {
        ResponseEntity<Map<String, Object>> resp = handler.handleBusinessRule(
                new IllegalArgumentException("Un personaje no puede competir contra sí mismo"),
                req("/api/votos"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertStandardShape(resp.getBody(), 400, "/api/votos");
        assertThat(resp.getBody().get("message")).isEqualTo("Un personaje no puede competir contra sí mismo");
    }

    @Test
    void illegalStateDevuelve409() {
        ResponseEntity<Map<String, Object>> resp = handler.handleBusinessRule(
                new IllegalStateException("El torneo ya está cerrado"), req("/api/torneos/1/votar"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertStandardShape(resp.getBody(), 409, "/api/torneos/1/votar");
    }

    @Test
    void responseStatusPreservaElStatusCustom() {
        ResponseEntity<Map<String, Object>> resp = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.I_AM_A_TEAPOT, "soy una tetera"),
                req("/api/teapot"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.I_AM_A_TEAPOT);
        assertStandardShape(resp.getBody(), 418, "/api/teapot");
        assertThat(resp.getBody().get("message")).isEqualTo("soy una tetera");
    }

    @Test
    void genericExceptionDevuelve500YnoFiltraElMensajeInterno() {
        ResponseEntity<Map<String, Object>> resp = handler.handleGenericException(
                new RuntimeException("NullPointerException en TorneoService.line42 secreto interno"),
                req("/api/torneos"), null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertStandardShape(resp.getBody(), 500, "/api/torneos");
        // CRÍTICO: el mensaje interno NO debe llegar al cliente.
        assertThat(resp.getBody().get("message").toString())
                .doesNotContain("NullPointerException")
                .doesNotContain("secreto interno")
                .doesNotContain("line42");
    }
}
