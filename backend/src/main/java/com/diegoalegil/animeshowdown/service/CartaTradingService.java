package com.diegoalegil.animeshowdown.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.CartaTradeCreateRequest;
import com.diegoalegil.animeshowdown.dto.CartaTradeDto;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.CartaTrade;
import com.diegoalegil.animeshowdown.model.CartaTradeEstado;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.CartaTradeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@Service
public class CartaTradingService {

    private static final long MAX_PENDING_INCOMING = 50;

    private final CartaTradeRepository tradeRepository;
    private final CartaRepository cartaRepository;
    private final UsuarioCartaRepository usuarioCartaRepository;
    private final UsuarioRepository usuarioRepository;
    private final AuditLogService auditLogService;

    public CartaTradingService(
            CartaTradeRepository tradeRepository,
            CartaRepository cartaRepository,
            UsuarioCartaRepository usuarioCartaRepository,
            UsuarioRepository usuarioRepository,
            AuditLogService auditLogService) {
        this.tradeRepository = tradeRepository;
        this.cartaRepository = cartaRepository;
        this.usuarioCartaRepository = usuarioCartaRepository;
        this.usuarioRepository = usuarioRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<CartaTradeDto> listar(Usuario usuario) {
        return tradeRepository.findByParticipante(usuario)
                .stream()
                .map(t -> CartaTradeDto.from(t, usuario))
                .toList();
    }

    @Transactional
    public CartaTradeDto crear(Usuario solicitante, CartaTradeCreateRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body requerido");
        }
        String idem = normalizarIdempotencyKey(request.idempotencyKey());
        var existente = tradeRepository.findBySolicitanteAndIdempotencyKey(solicitante, idem);
        if (existente.isPresent()) {
            return CartaTradeDto.from(existente.get(), solicitante);
        }
        if (request.cartaOfrecidaId() == null || request.cartaSolicitadaId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cartas requeridas");
        }
        if (request.cartaOfrecidaId().equals(request.cartaSolicitadaId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El intercambio requiere dos cartas distintas");
        }

        Usuario destinatario = usuarioRepository.findByUsername(requerido(request.destinatarioUsername(), "destinatarioUsername"))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario destinatario no encontrado"));
        if (destinatario.getId().equals(solicitante.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes intercambiar contigo mismo");
        }
        // Lock pesimista sobre la fila del destinatario ANTES de contar: serializa
        // los trade-create concurrentes hacia el MISMO destinatario, así el
        // check-then-act del tope de ofertas pendientes es atómico. Sin el lock,
        // dos solicitantes podrían leer count<tope a la vez y ambos insertar,
        // superándolo. Trades a destinatarios distintos no contienden (filas
        // distintas).
        usuarioRepository.findForUpdateById(destinatario.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario destinatario no encontrado"));
        if (tradeRepository.countByEstadoAndDestinatario(CartaTradeEstado.PENDING, destinatario) >= MAX_PENDING_INCOMING) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "El destinatario tiene demasiadas ofertas pendientes");
        }

        Carta ofrecida = cartaRepository.findById(request.cartaOfrecidaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carta ofrecida no encontrada"));
        Carta solicitada = cartaRepository.findById(request.cartaSolicitadaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carta solicitada no encontrada"));
        exigirPropiedad(solicitante, ofrecida.getId());
        exigirPropiedad(destinatario, solicitada.getId());

        CartaTrade trade = new CartaTrade(solicitante, destinatario, ofrecida, solicitada);
        trade.setIdempotencyKey(idem);
        trade = tradeRepository.save(trade);
        auditLogService.registrar(
                AuditEvento.CARTA_TRADE_CREADO,
                solicitante,
                Map.of(
                        "tradeId", trade.getId(),
                        "destinatario", destinatario.getUsername(),
                        "ofrecida", ofrecida.getId(),
                        "solicitada", solicitada.getId()),
                null);
        return CartaTradeDto.from(trade, solicitante);
    }

    @Transactional
    public CartaTradeDto aceptar(Usuario destinatario, Long tradeId) {
        CartaTrade trade = tradeForUpdate(tradeId);
        if (!trade.getDestinatario().getId().equals(destinatario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el destinatario puede aceptar");
        }
        exigirPendiente(trade);
        lockParticipantes(trade.getSolicitante(), trade.getDestinatario());
        UsuarioCarta ofrecida = exigirPropiedadForUpdate(trade.getSolicitante(), trade.getCartaOfrecida().getId());
        UsuarioCarta solicitada = exigirPropiedadForUpdate(trade.getDestinatario(), trade.getCartaSolicitada().getId());

        transferirCopia(ofrecida, trade.getDestinatario());
        transferirCopia(solicitada, trade.getSolicitante());
        trade.setEstado(CartaTradeEstado.ACCEPTED);
        trade.setRespondidoEn(LocalDateTime.now());
        trade = tradeRepository.save(trade);
        auditarResolucion(trade, destinatario);
        return CartaTradeDto.from(trade, destinatario);
    }

    @Transactional
    public CartaTradeDto rechazar(Usuario destinatario, Long tradeId) {
        CartaTrade trade = tradeForUpdate(tradeId);
        if (!trade.getDestinatario().getId().equals(destinatario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el destinatario puede rechazar");
        }
        exigirPendiente(trade);
        trade.setEstado(CartaTradeEstado.REJECTED);
        trade.setRespondidoEn(LocalDateTime.now());
        trade = tradeRepository.save(trade);
        auditarResolucion(trade, destinatario);
        return CartaTradeDto.from(trade, destinatario);
    }

    @Transactional
    public CartaTradeDto cancelar(Usuario solicitante, Long tradeId) {
        CartaTrade trade = tradeForUpdate(tradeId);
        if (!trade.getSolicitante().getId().equals(solicitante.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el solicitante puede cancelar");
        }
        exigirPendiente(trade);
        trade.setEstado(CartaTradeEstado.CANCELLED);
        trade.setRespondidoEn(LocalDateTime.now());
        trade = tradeRepository.save(trade);
        auditarResolucion(trade, solicitante);
        return CartaTradeDto.from(trade, solicitante);
    }

    private CartaTrade tradeForUpdate(Long tradeId) {
        if (tradeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tradeId requerido");
        }
        return tradeRepository.findForUpdateById(tradeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Intercambio no encontrado"));
    }

    private void exigirPendiente(CartaTrade trade) {
        if (trade.getEstado() != CartaTradeEstado.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El intercambio ya no está pendiente");
        }
    }

    private void exigirPropiedad(Usuario usuario, Long cartaId) {
        if (!usuarioCartaRepository.existsByUsuarioIdAndCartaId(usuario.getId(), cartaId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La colección no contiene la carta requerida");
        }
    }

    private UsuarioCarta exigirPropiedadForUpdate(Usuario usuario, Long cartaId) {
        return usuarioCartaRepository.findForUpdateByUsuarioIdAndCartaId(usuario.getId(), cartaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "La colección cambió; revisa el intercambio"));
    }

    private void lockParticipantes(Usuario a, Usuario b) {
        Long first = Math.min(a.getId(), b.getId());
        Long second = Math.max(a.getId(), b.getId());
        usuarioRepository.findForUpdateById(first)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Usuario no disponible"));
        usuarioRepository.findForUpdateById(second)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Usuario no disponible"));
    }

    private void transferirCopia(UsuarioCarta origen, Usuario destino) {
        Carta carta = origen.getCarta();
        if (origen.getCantidad() <= 1) {
            usuarioCartaRepository.delete(origen);
        } else {
            origen.setCantidad(origen.getCantidad() - 1);
            usuarioCartaRepository.save(origen);
        }
        UsuarioCarta destinoCarta = usuarioCartaRepository
                .findForUpdateByUsuarioIdAndCartaId(destino.getId(), carta.getId())
                .orElseGet(() -> new UsuarioCarta(destino, carta));
        if (destinoCarta.getId() == null) {
            usuarioCartaRepository.save(destinoCarta);
        } else {
            destinoCarta.incrementar();
            usuarioCartaRepository.save(destinoCarta);
        }
    }

    private void auditarResolucion(CartaTrade trade, Usuario actor) {
        auditLogService.registrar(
                AuditEvento.CARTA_TRADE_RESUELTO,
                actor,
                Map.of("tradeId", trade.getId(), "estado", trade.getEstado().name()),
                null);
    }

    private static String normalizarIdempotencyKey(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "idempotencyKey es obligatorio para crear intercambios");
        }
        String sane = raw.trim().replaceAll("[^A-Za-z0-9._:-]", "-");
        return sane.length() <= 80 ? sane : sane.substring(0, 80);
    }

    private static String requerido(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " requerido");
        }
        return value.trim();
    }
}
