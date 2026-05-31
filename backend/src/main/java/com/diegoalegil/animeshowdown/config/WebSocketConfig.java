package com.diegoalegil.animeshowdown.config;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.JwtUtil;

/**
 * Configuración WebSocket + STOMP.
 *
 * <h3>Endpoints y topics</h3>
 * <ul>
 *   <li><code>/ws</code> — endpoint público al que conecta el cliente con
 *       <code>@stomp/stompjs</code>. Sin SockJS (HTTP/2 + WS nativo cubre
 *       el 98% de los entornos).</li>
 *   <li><code>/topic/torneo.{id}.bracket</code> — broadcast público del
 *       estado del bracket cuando alguien vota o avanza una ronda.</li>
 *   <li><code>/user/queue/notificaciones</code> — push privado al usuario
 *       cuando se crea una notificación in-app suya.</li>
 * </ul>
 *
 * <h3>Autenticación</h3>
 * El cliente envía en el frame CONNECT:
 * <pre>Authorization: Bearer &lt;JWT&gt;</pre>
 * Si el cliente envía JWT, un {@link ChannelInterceptor} valida el token,
 * busca el usuario y setea el {@link java.security.Principal} en la sesión
 * STOMP — eso permite usar <code>convertAndSendToUser(usuario.getUsername(),...)</code>.
 * Si no envía token, el CONNECT queda anónimo y solo sirve para topics
 * públicos como ranking/brackets.
 *
 * <p>Los topics <code>/topic/**</code> permiten suscripciones sin auth (son
 * broadcast público). Las colas <code>/user/**</code> solo reciben eventos
 * útiles cuando el CONNECT incluye JWT y hay Principal.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

    private final JwtUtil jwtUtil;
    private final UsuarioRepository usuarioRepository;
    private final List<String> allowedOrigins;
    private final List<String> allowedOriginPatterns;

    public WebSocketConfig(
            JwtUtil jwtUtil,
            UsuarioRepository usuarioRepository,
            @Value("${cors.allowed-origins:}") String allowedOriginsCsv,
            @Value("${cors.allowed-origin-patterns:}") String allowedOriginPatternsCsv) {
        this.jwtUtil = jwtUtil;
        this.usuarioRepository = usuarioRepository;
        // Reutilizamos la misma lista de orígenes que SecurityConfig para CORS:
        // dev.local + cloudflare pages + producción. Sin esto, el browser
        // bloquea el handshake desde animeshowdown.dev hacia api.animeshowdown.dev.
        this.allowedOrigins = allowedOriginsCsv == null || allowedOriginsCsv.isBlank()
                ? List.of()
                : List.of(allowedOriginsCsv.split("\\s*,\\s*"));
        // SecurityConfig acepta patrones con wildcard para previews de Pages;
        // WebSocketConfig necesita aplicar la misma lista al handshake STOMP.
        this.allowedOriginPatterns = allowedOriginPatternsCsv == null || allowedOriginPatternsCsv.isBlank()
                ? List.of()
                : List.of(allowedOriginPatternsCsv.split("\\s*,\\s*"));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // SimpleBroker in-memory. Suficiente para single-instance Railway.
        // Si en el futuro escalamos a varias instancias, migrar a RabbitMQ
        // o Redis Pub/Sub para que un voto en instance-A llegue a clientes
        // conectados a instance-B.
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        // Cuando el server llama convertAndSendToUser("foo", "/queue/x",...),
        // Spring resuelve a "/user/foo/queue/x". El cliente se subscribe a
        // "/user/queue/x" y Spring hace el routing por Principal.
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        var endpoint = registry.addEndpoint("/ws");
        if (!allowedOrigins.isEmpty()) {
            endpoint.setAllowedOrigins(allowedOrigins.toArray(String[]::new));
        }
        if (!allowedOriginPatterns.isEmpty()) {
            endpoint.setAllowedOriginPatterns(allowedOriginPatterns.toArray(String[]::new));
        }
        // Sin.withSockJS() — confiamos en WebSocket nativo. Si surge algún
        // entorno bloqueado, el frontend usa el fallback al polling REST
        // existente.
    }

    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(new JwtAuthChannelInterceptor());
    }

    /**
     * Lee el header Authorization del frame CONNECT, valida el JWT y setea
     * el principal en la sesión STOMP. Sin header queda anónimo para topics
     * públicos; con header inválido sí se rechaza.
     */
    private class JwtAuthChannelInterceptor implements ChannelInterceptor {
        @Override
        public Message<?> preSend(Message<?> message, MessageChannel channel) {
            StompHeaderAccessor accessor =
                    MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
            if (accessor == null) {
                return message;
            }
            if (accessor.getCommand() == StompCommand.SEND
                    && accessor.getDestination() != null
                    && accessor.getDestination().startsWith("/app/duelo")
                    && accessor.getUser() == null) {
                log.warn("WS SEND PvP sin Principal — rechazado destination={}", accessor.getDestination());
                throw new IllegalArgumentException("Los mensajes PvP requieren JWT válido");
            }
            if (accessor.getCommand() != StompCommand.CONNECT) {
                return message;
            }
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null || authHeader.isBlank()) {
                log.debug("WS CONNECT anónimo — permitido para topics públicos");
                return message;
            }
            if (!authHeader.startsWith("Bearer ")) {
                log.warn("WS CONNECT con header Authorization mal formado — rechazado");
                throw new IllegalArgumentException("Header Authorization inválido");
            }
            String token = authHeader.substring(7);
            if (!jwtUtil.validarToken(token)) {
                log.warn("WS CONNECT con JWT inválido — rechazado");
                throw new IllegalArgumentException("Token JWT inválido o expirado");
            }
            String username = jwtUtil.extraerUsername(token);
            Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(username);
            if (usuarioOpt.isEmpty()) {
                log.warn("WS CONNECT con username inexistente: {}", username);
                throw new IllegalArgumentException("Usuario no encontrado");
            }
            Usuario usuario = usuarioOpt.get();
            if (jwtUtil.extraerTokenVersion(token) != usuario.getTokenVersion()) {
                log.warn("WS CONNECT con JWT revocado: username={}", username);
                throw new IllegalArgumentException("Token JWT revocado");
            }
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                            usuario,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getRol().name())));
            accessor.setUser(auth);
            log.debug("WS CONNECT OK: username={}", username);
            return message;
        }
    }
}
