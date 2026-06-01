package com.diegoalegil.animeshowdown.service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.dto.CartaShowcaseDto;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.CartaShowcase;
import com.diegoalegil.animeshowdown.model.CartaShowcaseSlot;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.CartaShowcaseRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;

@Service
public class CartaShowcaseService {

    private final CartaShowcaseRepository showcaseRepository;
    private final UsuarioCartaRepository usuarioCartaRepository;
    private final CartaRepository cartaRepository;
    private final AuditLogService auditLogService;

    public CartaShowcaseService(
            CartaShowcaseRepository showcaseRepository,
            UsuarioCartaRepository usuarioCartaRepository,
            CartaRepository cartaRepository,
            AuditLogService auditLogService) {
        this.showcaseRepository = showcaseRepository;
        this.usuarioCartaRepository = usuarioCartaRepository;
        this.cartaRepository = cartaRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<CartaShowcaseDto> misShowcases(Usuario usuario) {
        return showcaseRepository.findByUsuarioOrderBySlotAsc(usuario)
                .stream()
                .map(CartaShowcaseDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CartaShowcaseDto> publicosDe(String username) {
        return showcaseRepository.findByUsuarioUsernameOrderBySlotAsc(username)
                .stream()
                .map(CartaShowcaseDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CartaShowcaseDto> salonLegendario() {
        return showcaseRepository
                .findTop24BySlotInOrderByActualizadoEnDesc(Arrays.stream(CartaShowcaseSlot.values())
                        .filter(CartaShowcaseSlot::esSalon)
                        .toList())
                .stream()
                .map(CartaShowcaseDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CartaDto especialDePersonaje(String slug) {
        Carta carta = cartaRepository
                .findFirstByPersonajeSlugAndRarezaAndEspecialCuradaTrueOrderByIdAsc(slug, RarezaCarta.ESPECIAL)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carta especial no encontrada"));
        return CartaDto.from(carta, null);
    }

    @Transactional(readOnly = true)
    public CartaDto publica(Long cartaId) {
        Carta carta = cartaRepository.findById(cartaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carta no encontrada"));
        if (carta.getRareza() != RarezaCarta.ESPECIAL && !carta.isEspecialCurada()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo las cartas especiales son compartibles");
        }
        return CartaDto.from(carta, null);
    }

    @Transactional
    public CartaShowcaseDto fijar(Usuario usuario, CartaShowcaseSlot slot, Long cartaId) {
        if (cartaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cartaId requerido");
        }
        UsuarioCarta propia = usuarioCartaRepository.findByUsuarioIdAndCartaId(usuario.getId(), cartaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "No posees esta carta"));
        Carta carta = propia.getCarta();
        validarSlot(slot, carta);

        CartaShowcase showcase = showcaseRepository.findByUsuarioAndSlot(usuario, slot)
                .orElseGet(() -> new CartaShowcase(usuario, carta, slot));
        showcase.setCarta(carta);
        showcase.setSlot(slot);
        CartaShowcase guardado = showcaseRepository.save(showcase);
        auditLogService.registrar(
                AuditEvento.CARTA_SHOWCASE_CAMBIADA,
                usuario,
                Map.of("slot", slot.name(), "cartaId", carta.getId()),
                null);
        return CartaShowcaseDto.from(guardado);
    }

    @Transactional
    public void limpiar(Usuario usuario, CartaShowcaseSlot slot) {
        showcaseRepository.deleteByUsuarioAndSlot(usuario, slot);
        auditLogService.registrar(
                AuditEvento.CARTA_SHOWCASE_CAMBIADA,
                usuario,
                Map.of("slot", slot.name(), "limpiado", true),
                null);
    }

    public CartaShowcaseSlot parseSlot(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slot requerido");
        }
        try {
            return CartaShowcaseSlot.valueOf(raw.trim().toUpperCase().replace('-', '_'));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slot no soportado");
        }
    }

    private static void validarSlot(CartaShowcaseSlot slot, Carta carta) {
        boolean especial = carta.getRareza() == RarezaCarta.ESPECIAL || carta.isEspecialCurada();
        if ((slot.esSalon() || slot == CartaShowcaseSlot.DUEL_SKIN) && !especial) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este slot requiere carta especial");
        }
    }
}
