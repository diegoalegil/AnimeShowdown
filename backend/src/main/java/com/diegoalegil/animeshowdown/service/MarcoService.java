package com.diegoalegil.animeshowdown.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.MarcoDto;
import com.diegoalegil.animeshowdown.dto.MarcosResponse;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Marco;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioMarco;
import com.diegoalegil.animeshowdown.repository.UsuarioMarcoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Marcos de avatar comprables con moneda blanda (cosmético coin-sink, V72).
 *
 * <p><b>Compra atómica anti-doble-cobro.</b> La fila de posesión se inserta
 * ANTES de debitar, dentro de la misma transacción:
 * <ul>
 *   <li>La UNIQUE {@code (usuario_id, marco_id)} serializa dos compras
 *       concurrentes del mismo marco: la segunda bloquea en el índice y, al
 *       confirmar la primera, lanza {@link DataIntegrityViolationException} →
 *       su transacción hace rollback y NUNCA llega a debitar.</li>
 *   <li>Si el débito falla por saldo insuficiente (409), el rollback de la
 *       transacción deshace también el INSERT de posesión.</li>
 * </ul>
 * Así nunca queda un marco "comprado" sin pagar ni un cobro sin marco. El
 * débito ({@link MonederoService#debitar}) usa lock pesimista sobre el monedero,
 * que serializa además gastos concurrentes de marcos distintos del mismo usuario.
 */
@Service
public class MarcoService {

    private final UsuarioMarcoRepository usuarioMarcoRepo;
    private final UsuarioRepository usuarioRepo;
    private final MonederoService monederoService;
    private final AuditLogService auditLogService;

    public MarcoService(UsuarioMarcoRepository usuarioMarcoRepo,
                        UsuarioRepository usuarioRepo,
                        MonederoService monederoService,
                        AuditLogService auditLogService) {
        this.usuarioMarcoRepo = usuarioMarcoRepo;
        this.usuarioRepo = usuarioRepo;
        this.monederoService = monederoService;
        this.auditLogService = auditLogService;
    }

    /** Catálogo + saldo + estado (poseído/equipado) del usuario autenticado. */
    @Transactional(readOnly = true)
    public MarcosResponse estado(Usuario usuario) {
        return construir(usuario, equipadoDe(usuario));
    }

    /**
     * Compra un marco: descuenta su precio del monedero e inserta la posesión,
     * de forma atómica e idempotente. Lanza 404 si el marco no existe, 409 si ya
     * lo posee, y 409 (saldo insuficiente) propagado desde {@link MonederoService}.
     */
    @Transactional
    public MarcosResponse comprar(Usuario usuario, String marcoId, HttpServletRequest request) {
        Marco marco = MarcoCatalogo.porId(marcoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Marco no encontrado"));

        if (usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(usuario.getId(), marco.id())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya tienes este marco");
        }

        // INSERT de posesión primero: la UNIQUE serializa compras concurrentes
        // del mismo marco (la 2ª lanza DataIntegrityViolationException). El débito
        // va después; si falla por saldo, el rollback de la tx deshace el INSERT.
        try {
            usuarioMarcoRepo.saveAndFlush(new UsuarioMarco(usuario, marco.id()));
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya tienes este marco");
        }

        long saldoRestante = monederoService.debitar(usuario, MotivoMovimiento.COMPRA_MARCO,
                "marco:" + marco.id(), marco.precio());

        // Transparencia anti-casino: todo gasto queda en ledger Y audit log
        // (mismo patrón que COMPRA_SOBRE). Audit es @Async y best-effort.
        auditLogService.registrar(
                AuditEvento.MARCO_COMPRADO,
                usuario,
                Map.of(
                        "marco", marco.id(),
                        "precio", marco.precio(),
                        "saldo", saldoRestante),
                request);

        return construir(usuario, equipadoDe(usuario));
    }

    /**
     * Equipa un marco poseído (o lo desequipa si {@code marcoId} es null/vacío).
     * Lanza 404 si el marco no existe y 409 si el usuario no lo posee.
     */
    @Transactional
    public MarcosResponse equipar(Usuario usuario, String marcoId) {
        String objetivo = (marcoId == null || marcoId.isBlank()) ? null : marcoId;
        if (objetivo != null) {
            if (!MarcoCatalogo.existe(objetivo)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Marco no encontrado");
            }
            if (!usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(usuario.getId(), objetivo)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "No tienes este marco");
            }
        }
        // Cargar fresco: el principal del JWT puede estar desligado/obsoleto.
        Usuario gestionado = usuarioRepo.findById(usuario.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        gestionado.setMarcoAvatar(objetivo);
        usuarioRepo.save(gestionado);
        return construir(usuario, objetivo);
    }

    private MarcosResponse construir(Usuario usuario, String equipado) {
        Set<String> poseidos = poseidosDe(usuario);
        return new MarcosResponse(
                monederoService.saldoDe(usuario),
                equipado,
                catalogo(poseidos, equipado));
    }

    private Set<String> poseidosDe(Usuario usuario) {
        return usuarioMarcoRepo.findByUsuarioId(usuario.getId()).stream()
                .map(UsuarioMarco::getMarcoId)
                .collect(Collectors.toSet());
    }

    private String equipadoDe(Usuario usuario) {
        return usuarioRepo.findById(usuario.getId())
                .map(Usuario::getMarcoAvatar)
                .orElse(usuario.getMarcoAvatar());
    }

    private List<MarcoDto> catalogo(Set<String> poseidos, String equipado) {
        return MarcoCatalogo.todos().stream()
                .map(m -> MarcoDto.from(m, poseidos.contains(m.id()), m.id().equals(equipado)))
                .toList();
    }
}
