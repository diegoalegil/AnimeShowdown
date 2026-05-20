package com.diegoalegil.animeshowdown.security;

import java.io.IOException;
import java.net.URI;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.OAuthAccountService;
import com.diegoalegil.animeshowdown.service.RefreshTokenService;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Puente OAuth -> sesión propia. Spring resuelve Google/Discord; nosotros
 * linkeamos por email, emitimos refresh cookie httpOnly y mandamos al
 * frontend a /auth/callback para hidratar el access JWT vía /refresh.
 */
@Component
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);
    private static final String REFRESH_COOKIE = "refresh_token";

    private final OAuthAccountService oauthAccountService;
    private final RefreshTokenService refreshTokenService;
    private final AuditLogService auditLogService;
    private final ClientIpExtractor clientIpExtractor;
    private final boolean cookieSecure;
    private final String redirectBase;

    public OAuth2LoginSuccessHandler(
            OAuthAccountService oauthAccountService,
            RefreshTokenService refreshTokenService,
            AuditLogService auditLogService,
            ClientIpExtractor clientIpExtractor,
            @Value("${app.refresh-token.cookie-secure:true}") boolean cookieSecure,
            @Value("${app.oauth.redirect-base:https://animeshowdown.dev}") String redirectBase) {
        this.oauthAccountService = oauthAccountService;
        this.refreshTokenService = refreshTokenService;
        this.auditLogService = auditLogService;
        this.clientIpExtractor = clientIpExtractor;
        this.cookieSecure = cookieSecure;
        this.redirectBase = normalizarBase(redirectBase);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        if (!(authentication instanceof OAuth2AuthenticationToken token)
                || !(token.getPrincipal() instanceof OAuth2User oauthUser)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "OAuth inválido");
            return;
        }

        String provider = token.getAuthorizedClientRegistrationId();
        Map<String, Object> attributes = oauthUser.getAttributes();
        String ip = clientIpExtractor.extract(request);
        String userAgent = extraerUserAgent(request);
        try {
            OAuthAccountService.ResultadoOAuth result =
                    oauthAccountService.resolverOCrear(provider, attributes);
            Usuario usuario = result.usuario();
            String refreshPlano = refreshTokenService.emitir(
                    usuario, userAgent, ip);

            response.addHeader(HttpHeaders.SET_COOKIE, construirCookieRefresh(refreshPlano).toString());
            if (result.creado()) {
                auditLogService.registrarConContexto(AuditEvento.OAUTH_REGISTRO, usuario,
                        Map.of("provider", provider), ip, userAgent);
            }
            auditLogService.registrarConContexto(AuditEvento.OAUTH_LOGIN_OK, usuario,
                    Map.of("provider", provider), ip, userAgent);

            log.info("OAuth login OK: provider={} username={} creado={}",
                    provider, usuario.getUsername(), result.creado());
            response.sendRedirect(UriComponentsBuilder
                    .fromUriString(redirectBase)
                    .path("/auth/callback")
                    .queryParam("oauth", "success")
                    .queryParam("provider", provider)
                    .build()
                    .toUriString());
        } catch (IllegalArgumentException e) {
            log.warn("OAuth login rechazado provider={}: {}", provider, e.getMessage());
            response.sendRedirect(UriComponentsBuilder
                    .fromUriString(redirectBase)
                    .path("/login")
                    .queryParam("oauth", "error")
                    .queryParam("reason", "email")
                    .build()
                    .toUriString());
        }
    }

    private ResponseCookie construirCookieRefresh(String tokenPlano) {
        return ResponseCookie.from(REFRESH_COOKIE, tokenPlano)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(refreshTokenService.getTtl())
                .build();
    }

    private static String extraerUserAgent(HttpServletRequest req) {
        String ua = req.getHeader("User-Agent");
        if (ua == null) return null;
        return ua.length() > 500 ? ua.substring(0, 500) : ua;
    }

    private static String normalizarBase(String value) {
        String raw = value == null || value.isBlank() ? "https://animeshowdown.dev" : value.trim();
        URI uri = URI.create(raw);
        String normalized = uri.toString();
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
    }
}
