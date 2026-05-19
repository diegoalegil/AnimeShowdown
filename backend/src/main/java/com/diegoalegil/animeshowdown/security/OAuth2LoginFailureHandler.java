package com.diegoalegil.animeshowdown.security;

import java.io.IOException;
import java.net.URI;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class OAuth2LoginFailureHandler implements AuthenticationFailureHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2LoginFailureHandler.class);

    private final String redirectBase;

    public OAuth2LoginFailureHandler(
            @Value("${app.oauth.redirect-base:https://animeshowdown.dev}") String redirectBase) {
        this.redirectBase = normalizarBase(redirectBase);
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException exception) throws IOException, ServletException {
        log.warn("OAuth login falló: {}", exception.getMessage());
        response.sendRedirect(UriComponentsBuilder
                .fromUriString(redirectBase)
                .path("/login")
                .queryParam("oauth", "error")
                .build()
                .toUriString());
    }

    private static String normalizarBase(String value) {
        String raw = value == null || value.isBlank() ? "https://animeshowdown.dev" : value.trim();
        URI uri = URI.create(raw);
        String normalized = uri.toString();
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
    }
}
