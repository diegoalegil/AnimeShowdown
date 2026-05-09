package com.diegoalegil.animeshowdown.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.RegistroRequest;
import com.diegoalegil.animeshowdown.dto.UsuarioRespuesta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/registro")
    public ResponseEntity<?> registro(@RequestBody RegistroRequest request) {

        if (usuarioRepository.findByUsername(request.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("El username ya existe");
        }

        String passwordHasheado = passwordEncoder.encode(request.getPassword());

        Usuario nuevoUsuario = new Usuario(
                request.getUsername(),
                passwordHasheado,
                request.getEmail());

        Usuario guardado = usuarioRepository.save(nuevoUsuario);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UsuarioRespuesta(guardado));
    }
}