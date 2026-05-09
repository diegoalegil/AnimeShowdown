package com.diegoalegil.animeshowdown.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.diegoalegil.animeshowdown.dto.LoginRequest;
import com.diegoalegil.animeshowdown.dto.RegistroRequest;
import com.diegoalegil.animeshowdown.dto.TokenRespuesta;
import com.diegoalegil.animeshowdown.dto.UsuarioRespuesta;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.security.JwtUtil;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final Set<String> adminEmails;

    public AuthController(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            @Value("${admin.emails:diegogildam@gmail.com}") String adminEmailsCsv) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toCollection(HashSet::new));
        log.info("AuthController arrancado con {} email(s) auto-admin: {}", adminEmails.size(), adminEmails);
    }

    @PostMapping("/registro")
    public ResponseEntity<?> registro(@Valid @RequestBody RegistroRequest request) {

        if (usuarioRepository.findByUsername(request.getUsername()).isPresent()) {
            log.warn("Intento de registro con username ya existente: {}", request.getUsername());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("El username ya existe");
        }

        if (usuarioRepository.findByEmail(request.getEmail()).isPresent()) {
            log.warn("Intento de registro con email ya existente: {}", request.getEmail());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("El email ya está registrado");
        }

        String passwordHasheado = passwordEncoder.encode(request.getPassword());

        Usuario nuevoUsuario = new Usuario(
                request.getUsername(),
                passwordHasheado,
                request.getEmail());

        if (adminEmails.contains(request.getEmail().toLowerCase())) {
            nuevoUsuario.setRol(Rol.ADMIN);
            log.info("Auto-promoción a ADMIN: email={}", request.getEmail());
        }

        Usuario guardado = usuarioRepository.save(nuevoUsuario);

        log.info("Usuario registrado: id={} username={} rol={}", guardado.getId(), guardado.getUsername(), guardado.getRol());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UsuarioRespuesta(guardado));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {

        // Acepta username o email en el campo username (UX: usuario teclea cualquiera)
        String identificador = request.getUsername();
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(identificador)
                .or(() -> usuarioRepository.findByEmail(identificador));

        if (usuarioOpt.isEmpty()) {
            log.warn("Login fallido (usuario/email no existe): {}", identificador);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        Usuario usuario = usuarioOpt.get();

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            log.warn("Login fallido (password incorrecta): username={}", usuario.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Credenciales inválidas");
        }

        String token = jwtUtil.generarToken(usuario);

        log.info("Login exitoso: username={} rol={}", usuario.getUsername(), usuario.getRol());

        return ResponseEntity.ok(new TokenRespuesta(token, new UsuarioRespuesta(usuario)));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(auth.getName());
        return usuarioOpt
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(new UsuarioRespuesta(u)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PutMapping("/me/avatar")
    public ResponseEntity<?> actualizarAvatar(
            @RequestBody Map<String, String> body,
            Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(auth.getName());
        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Usuario u = usuarioOpt.get();
        String avatarUrl = body.get("avatarUrl");
        if (avatarUrl != null && avatarUrl.length() > 500_000) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("avatarUrl demasiado largo (máx 500 KB)");
        }
        u.setAvatarUrl(avatarUrl != null && avatarUrl.isBlank() ? null : avatarUrl);
        usuarioRepository.save(u);
        log.info("Avatar actualizado: username={}", u.getUsername());
        return ResponseEntity.ok(new UsuarioRespuesta(u));
    }
}
