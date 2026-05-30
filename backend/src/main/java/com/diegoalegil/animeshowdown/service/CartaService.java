package com.diegoalegil.animeshowdown.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.AbrirSobreResultadoDto;
import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;

/**
 * Colección de cartas del usuario y apertura de sobres. La apertura es
 * server-authoritative: gasta moneda (MonederoService) y la carta la elige el
 * servidor (RarezaService) según odds transparentes.
 */
@Service
public class CartaService {

    private static final Logger log = LoggerFactory.getLogger(CartaService.class);

    private final CartaRepository cartaRepository;
    private final UsuarioCartaRepository usuarioCartaRepository;
    private final MonederoService monederoService;
    private final RarezaService rarezaService;
    private final AuditLogService auditLogService;

    public CartaService(
            CartaRepository cartaRepository,
            UsuarioCartaRepository usuarioCartaRepository,
            MonederoService monederoService,
            RarezaService rarezaService,
            AuditLogService auditLogService) {
        this.cartaRepository = cartaRepository;
        this.usuarioCartaRepository = usuarioCartaRepository;
        this.monederoService = monederoService;
        this.rarezaService = rarezaService;
        this.auditLogService = auditLogService;
    }

    /** Catálogo completo + posesión del usuario + progreso + saldo. */
    @Transactional(readOnly = true)
    public ColeccionDto coleccion(Usuario usuario) {
        List<Carta> catalogo = cartaRepository.findAllByOrderByIdAsc();
        List<UsuarioCarta> mias = usuarioCartaRepository.findByUsuarioOrderByObtenidaEnDesc(usuario);

        Map<Long, UsuarioCarta> porCartaId = new HashMap<>();
        for (UsuarioCarta uc : mias) {
            porCartaId.put(uc.getCarta().getId(), uc);
        }

        List<CartaDto> cartas = catalogo.stream()
                .map(c -> CartaDto.from(c, porCartaId.get(c.getId())))
                .toList();

        int totalCatalogo = cartas.size();
        int totalPoseidas = (int) cartas.stream().filter(CartaDto::poseida).count();
        int porcentaje = totalCatalogo == 0
                ? 0
                : (int) Math.round(100.0 * totalPoseidas / totalCatalogo);
        long saldo = monederoService.saldoDe(usuario);

        return new ColeccionDto(totalCatalogo, totalPoseidas, porcentaje, saldo, cartas);
    }

    /**
     * Abre un sobre: gasta el precio (409 si no alcanza), elige una carta SSR y
     * la suma a la colección (incrementa duplicados). El lock pesimista de
     * {@link MonederoService#debitar} serializa aperturas concurrentes del mismo
     * usuario, así que el upsert de la carta no compite consigo mismo.
     */
    @Transactional
    public AbrirSobreResultadoDto abrirSobre(Usuario usuario) {
        long precio = rarezaService.precioSobre();
        String referencia = "sobre:" + UUID.randomUUID();
        long saldoRestante = monederoService.debitar(
                usuario, MotivoMovimiento.COMPRA_SOBRE, referencia, precio);

        Carta carta = rarezaService.elegirCartaDeSobre();

        UsuarioCarta poseida = usuarioCartaRepository.findByUsuarioAndCarta(usuario, carta).orElse(null);
        boolean nueva = poseida == null;
        if (nueva) {
            poseida = usuarioCartaRepository.save(new UsuarioCarta(usuario, carta));
        } else {
            poseida.incrementar();
            poseida = usuarioCartaRepository.save(poseida);
        }

        auditLogService.registrar(
                AuditEvento.SOBRE_ABIERTO,
                usuario,
                Map.of(
                        "cartaId", carta.getId(),
                        "personajeSlug", carta.getPersonaje().getSlug(),
                        "rareza", carta.getRareza().name(),
                        "nueva", nueva,
                        "precio", precio,
                        "saldo", saldoRestante),
                null);
        log.info("Sobre abierto: usuario={} carta={} rareza={} nueva={} saldo={}",
                usuario.getUsername(), carta.getPersonaje().getSlug(), carta.getRareza(), nueva, saldoRestante);

        return new AbrirSobreResultadoDto(CartaDto.from(carta, poseida), nueva, saldoRestante, precio);
    }
}
