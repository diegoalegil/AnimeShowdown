package com.diegoalegil.animeshowdown.service;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;

/**
 * Carta destacada del perfil: el usuario fija UNA carta que ya posee como
 * destacada. Server-authoritative — valida la posesión antes de destacar y
 * limpia la anterior en la misma transacción (a lo sumo una destacada por
 * usuario sin necesitar un índice parcial, que H2 no soporta).
 */
@Service
public class CartaDestacadaService {

    private final UsuarioCartaRepository repository;

    public CartaDestacadaService(UsuarioCartaRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public CartaDto destacar(Usuario usuario, Long cartaId) {
        UsuarioCarta propia = repository.findByUsuarioAndCartaId(usuario, cartaId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No posees esa carta"));
        repository.findByUsuarioAndDestacadaTrue(usuario).ifPresent(prev -> {
            if (!prev.getId().equals(propia.getId())) {
                prev.setDestacada(false);
                repository.save(prev);
            }
        });
        propia.setDestacada(true);
        UsuarioCarta guardada = repository.save(propia);
        return CartaDto.from(guardada.getCarta(), guardada);
    }

    @Transactional
    public void quitar(Usuario usuario) {
        repository.findByUsuarioAndDestacadaTrue(usuario).ifPresent(uc -> {
            uc.setDestacada(false);
            repository.save(uc);
        });
    }

    @Transactional(readOnly = true)
    public Optional<CartaDto> obtenerDestacada(Usuario usuario) {
        return repository.findByUsuarioAndDestacadaTrue(usuario)
                .map(uc -> CartaDto.from(uc.getCarta(), uc));
    }
}
