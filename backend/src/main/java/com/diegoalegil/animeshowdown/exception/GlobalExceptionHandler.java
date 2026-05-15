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

    /** Validación de @Valid: mantenemos forma original {field: message}. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errores = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(
                error -> errores.put(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errores);
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
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message != null ? message : status.getReasonPhrase());
        body.put("path", req.getRequestURI());
        return ResponseEntity.status(status).body(body);
    }
}
