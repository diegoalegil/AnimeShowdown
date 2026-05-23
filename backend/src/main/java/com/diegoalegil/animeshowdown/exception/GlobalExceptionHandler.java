package com.diegoalegil.animeshowdown.exception;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Centraliza el manejo de excepciones del backend para que el frontend reciba
 * siempre un cuerpo JSON con la misma forma (excepto validación de @Valid, que
 * mantiene su forma original {field: message} para compatibilidad con tests
 * que ya la consumen).
 *
 * Forma estándar para errores NO de validación:
 * {
 *   "timestamp": "2026-05-15T22:30:00+02:00",
 *   "status": 404,
 *   "error": "Not Found",
 *   "message": "Personaje no encontrado",
 *   "path": "/api/personajes/999"
 * }
 *
 * Antes este handler solo cubría MethodArgumentNotValidException, así que las
 * 404, 500, conflicts de BD y errores de autenticación devolvían bodies
 * inconsistentes: a veces String, a veces vacío, a veces stack trace. Ahora
 * todos pasan por aquí.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Validación de @Valid.
     *
     * <p>Ajuste #14 (2026-05-21): antes devolvíamos {@code Map<field, msg>}
     * plano — forma distinta al resto de errores (que usan
     * {@code {status, message, timestamp, path}}). El frontend tenía que
     * detectar la forma según status code. Ahora uniformizamos: shape
     * estándar + campo {@code errors} con el field map dentro. Consumers
     * existentes siguen funcionando si leen {@code body.message}, y los
     * que quieran highlight por campo leen {@code body.errors[field]}.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> errores = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(
                error -> errores.put(error.getField(), error.getDefaultMessage()));
        String summary = errores.isEmpty()
                ? "Validación fallida"
                : "Validación fallida: " + String.join(", ", errores.keySet());
        Map<String, Object> body = baseResponse(HttpStatus.BAD_REQUEST, summary, req);
        body.put("errors", errores);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /** Recurso no encontrado: 404. */
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(
            EntityNotFoundException ex, HttpServletRequest req) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    /** Constraint violation, FK rota, duplicate unique: 409. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(
            DataIntegrityViolationException ex, HttpServletRequest req) {
        log.warn("Data integrity violation en {}: {}", req.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return buildResponse(
                HttpStatus.CONFLICT,
                "El recurso ya existe o viola una restricción de integridad",
                req);
    }

    /** JSON malformado, body vacío en endpoint que espera body: 400. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleMalformedJson(
            HttpMessageNotReadableException ex, HttpServletRequest req) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "El cuerpo de la petición no es un JSON válido o está vacío",
                req);
    }

    /** Type mismatch en @PathVariable / @RequestParam (ej: id=abc en endpoint Long): 400. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest req) {
        String requiredType = ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "tipo válido";
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "El parámetro '" + ex.getName() + "' debe ser " + requiredType,
                req);
    }

    /** Credenciales inválidas en login: 401. */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(
            BadCredentialsException ex, HttpServletRequest req) {
        return buildResponse(HttpStatus.UNAUTHORIZED, "Credenciales inválidas", req);
    }

    /** Acceso denegado (rol insuficiente): 403. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException ex, HttpServletRequest req) {
        return buildResponse(
                HttpStatus.FORBIDDEN,
                "No tienes permisos para acceder a este recurso",
                req);
    }

    /** Ruta inexistente: 404. */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoHandler(
            NoHandlerFoundException ex, HttpServletRequest req) {
        return buildResponse(
                HttpStatus.NOT_FOUND,
                "Endpoint no encontrado: " + ex.getHttpMethod() + " " + ex.getRequestURL(),
                req);
    }

    /**
     * Regla de negocio violada por el controller/service (ej: votar fuera de
     * torneo activo, personaje contra sí mismo). Se identifica por
     * IllegalArgumentException o IllegalStateException, que son las que se
     * usan en el código actual.
     */
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, Object>> handleBusinessRule(
            RuntimeException ex, HttpServletRequest req) {
        HttpStatus status = ex instanceof IllegalStateException
                ? HttpStatus.CONFLICT
                : HttpStatus.BAD_REQUEST;
        return buildResponse(status, ex.getMessage(), req);
    }

    /**
     * Ajuste #11 follow-up (2026-05-21): handler explicito para
     * ResponseStatusException. Sin este handler, el catch-all
     * Exception.class de abajo capturaba las ResponseStatusException
     * antes que Spring's ResponseStatusExceptionResolver pudiera
     * procesarlas, devolviendo 500 en lugar del status especificado.
     * Ahora preservamos status + razon + el shape estandar del resto
     * de handlers.
     */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(
            org.springframework.web.server.ResponseStatusException ex,
            HttpServletRequest req) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String message = ex.getReason() != null
                ? ex.getReason()
                : status.getReasonPhrase();
        return buildResponse(status, message, req);
    }

    /**
     * Fallback para cualquier cosa que no hayamos contemplado. NO devolvemos
     * el mensaje real al cliente (puede contener stack trace, info interna),
     * pero sí lo logueamos para diagnóstico.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(
            Exception ex, HttpServletRequest req, WebRequest webReq) {
        log.error("Excepción no controlada en {}: {}", req.getRequestURI(), ex.getMessage(), ex);
        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Error interno del servidor. Inténtalo de nuevo en unos minutos.",
                req);
    }

    /**
     * Construye el body de error con forma consistente. Usamos LinkedHashMap
     * para que el orden de las claves sea estable en la respuesta JSON.
     */
    private ResponseEntity<Map<String, Object>> buildResponse(
            HttpStatus status, String message, HttpServletRequest req) {
        return ResponseEntity.status(status).body(baseResponse(status, message, req));
    }

    /**
     * Ajuste #14 (2026-05-21): extraido baseResponse para que el
     * handler de @Valid pueda anadir el campo extra 'errors' al body
     * estandar sin duplicar codigo.
     */
    private Map<String, Object> baseResponse(
            HttpStatus status, String message, HttpServletRequest req) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message != null ? message : status.getReasonPhrase());
        body.put("path", req.getRequestURI());
        return body;
    }
}
