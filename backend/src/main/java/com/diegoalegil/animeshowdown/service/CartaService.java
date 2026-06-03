package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.AbrirSobreResultadoDto;
import com.diegoalegil.animeshowdown.dto.CartaCatalogoItem;
import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.dto.CofreDiarioDto;
import com.diegoalegil.animeshowdown.dto.ColeccionAnimeDto;
import com.diegoalegil.animeshowdown.dto.ColeccionDto;
import com.diegoalegil.animeshowdown.dto.SobreCartaDto;
import com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.CartaClimax;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.SobreApertura;
import com.diegoalegil.animeshowdown.model.SobreAperturaItem;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.model.UsuarioCartaPity;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;
import com.diegoalegil.animeshowdown.repository.SobreAperturaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaPityRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

import jakarta.persistence.EntityManager;

/**
 * Colección de cartas y apertura de sobres. El servidor decide el contenido
 * completo del pack (4 normales + 1 clímax), actualiza colección, pity, saldo
 * y audit log en la misma transacción.
 */
@Service
public class CartaService {

    private static final Logger log = LoggerFactory.getLogger(CartaService.class);
    private static final int CARTAS_REVELADAS = 5;

    private final UsuarioCartaRepository usuarioCartaRepository;
    private final UsuarioCartaPityRepository pityRepository;
    private final SobreAperturaRepository sobreAperturaRepository;
    private final MonederoMovimientoRepository movimientoRepository;
    private final UsuarioRepository usuarioRepository;
    private final MonederoService monederoService;
    private final RarezaService rarezaService;
    private final AuditLogService auditLogService;
    private final CartaLecturaCacheService cartaLecturaCacheService;
    private final EntityManager entityManager;
    private final Clock clock;
    private final long recompensaDuplicado;
    private final long cofreDiarioMoneda;

    public CartaService(
            UsuarioCartaRepository usuarioCartaRepository,
            UsuarioCartaPityRepository pityRepository,
            SobreAperturaRepository sobreAperturaRepository,
            MonederoMovimientoRepository movimientoRepository,
            UsuarioRepository usuarioRepository,
            MonederoService monederoService,
            RarezaService rarezaService,
            AuditLogService auditLogService,
            CartaLecturaCacheService cartaLecturaCacheService,
            EntityManager entityManager,
            Clock clock,
            @Value("${app.cartas.duplicado.recompensa:10}") long recompensaDuplicado,
            @Value("${app.cartas.cofre-diario.moneda:50}") long cofreDiarioMoneda) {
        this.usuarioCartaRepository = usuarioCartaRepository;
        this.pityRepository = pityRepository;
        this.sobreAperturaRepository = sobreAperturaRepository;
        this.movimientoRepository = movimientoRepository;
        this.usuarioRepository = usuarioRepository;
        this.monederoService = monederoService;
        this.rarezaService = rarezaService;
        this.auditLogService = auditLogService;
        this.cartaLecturaCacheService = cartaLecturaCacheService;
        this.entityManager = entityManager;
        this.clock = clock;
        this.recompensaDuplicado = Math.max(0L, recompensaDuplicado);
        this.cofreDiarioMoneda = Math.max(0L, cofreDiarioMoneda);
    }

    /** Catálogo completo + posesión del usuario + progreso + saldo. */
    @Transactional(readOnly = true)
    public ColeccionDto coleccion(Usuario usuario) {
        List<CartaCatalogoItem> catalogo = cartaLecturaCacheService.catalogo();
        List<UsuarioCartaPosesionItem> mias = usuarioCartaRepository.findPosesionesByUsuario(usuario);
        Map<Long, Long> eloPorPersonaje = cartaLecturaCacheService.votosPorPersonaje();

        Map<Long, UsuarioCartaPosesionItem> porCartaId = new HashMap<>();
        for (UsuarioCartaPosesionItem uc : mias) {
            porCartaId.put(uc.cartaId(), uc);
        }

        List<CartaDto> cartas = catalogo.stream()
                .map(c -> CartaDto.from(c, porCartaId.get(c.id()),
                        eloPorPersonaje.getOrDefault(c.personajeId(), 0L)))
                .toList();

        int totalCatalogo = cartas.size();
        int totalPoseidas = (int) cartas.stream().filter(CartaDto::poseida).count();
        int porcentaje = totalCatalogo == 0
                ? 0
                : (int) Math.round(100.0 * totalPoseidas / totalCatalogo);
        long saldo = monederoService.saldoDe(usuario);
        int pityActual = pityRepository.findById(usuario.getId())
                .map(UsuarioCartaPity::getSobresSinEspecial)
                .orElse(0);

        return new ColeccionDto(totalCatalogo, totalPoseidas, porcentaje, saldo,
                pityActual, rarezaService.pityDuro(), cofreDiarioDisponible(usuario),
                usuario.getSobreBienvenidaReclamadoEn() == null,
                progresoPorAnime(cartas), cartas);
    }

    /**
     * Abre un sobre. Repetir la misma idempotencyKey devuelve el mismo
     * resultado ya persistido y no vuelve a debitar moneda.
     */
    @Transactional
    public AbrirSobreResultadoDto abrirSobre(Usuario usuario, String idempotencyKey) {
        String idem = normalizarIdempotencyKey(idempotencyKey);
        SobreApertura existente = sobreAperturaRepository
                .findByUsuarioAndIdempotencyKey(usuario, idem)
                .orElse(null);
        if (existente != null) {
            return dtoDesdeApertura(usuario, existente);
        }

        long precio = rarezaService.precioSobre();
        String referencia = "sobre:" + idem;
        UsuarioCartaPity pity = pityForUpdate(usuario);
        existente = sobreAperturaRepository
                .findByUsuarioAndIdempotencyKey(usuario, idem)
                .orElse(null);
        if (existente != null) {
            return dtoDesdeApertura(usuario, existente);
        }
        int pityAntes = pity.getSobresSinEspecial();
        boolean pedirEspecial = rarezaService.debeSalirEspecial(pityAntes);
        RarezaService.SobreDraw draw = rarezaService.elegirSobre(pedirEspecial);
        boolean especial = draw.especial();

        long saldoRestante = monederoService.debitar(
                usuario, MotivoMovimiento.COMPRA_SOBRE, referencia, precio);

        List<Carta> pack = new ArrayList<>(draw.normales());
        pack.add(draw.climax());

        SobreApertura apertura = new SobreApertura(usuario, idem);
        apertura.setPrecio(precio);
        apertura.setPityAntes(pityAntes);
        apertura.setEspecial(especial);

        long monedasDuplicados = 0L;
        for (int i = 0; i < pack.size(); i++) {
            Carta carta = pack.get(i);
            UsuarioCarta poseida = usuarioCartaRepository.findByUsuarioAndCarta(usuario, carta).orElse(null);
            boolean nueva = poseida == null;
            long recompensa = 0L;
            if (nueva) {
                usuarioCartaRepository.save(new UsuarioCarta(usuario, carta));
            } else {
                poseida.incrementar();
                usuarioCartaRepository.save(poseida);
                recompensa = acreditarDuplicado(usuario, idem, carta, i + 1);
                if (recompensa > 0) {
                    monedasDuplicados += recompensa;
                    saldoRestante += recompensa;
                }
            }
            apertura.addItem(new SobreAperturaItem(carta, i + 1, nueva,
                    recompensa, climaxDe(i, especial)));
        }

        int pityDespues = especial ? 0 : pityAntes + 1;
        pity.setSobresSinEspecial(pityDespues);
        pityRepository.save(pity);
        apertura.setPityDespues(pityDespues);
        apertura.setSaldoRestante(saldoRestante);
        apertura.setMonedasDuplicados(monedasDuplicados);
        apertura = sobreAperturaRepository.save(apertura);

        auditLogService.registrar(
                AuditEvento.SOBRE_ABIERTO,
                usuario,
                Map.of(
                        "cartas", pack.stream()
                                .map(c -> c.getPersonaje().getSlug() + ":" + c.getRareza().name())
                                .toList(),
                        "especial", especial,
                        "pityAntes", pityAntes,
                        "pityDespues", pityDespues,
                        "monedasDuplicados", monedasDuplicados,
                        "precio", precio,
                        "saldo", saldoRestante),
                null);
        log.info("Sobre abierto: usuario={} cartas={} especial={} pity={}->{} saldo={}",
                usuario.getUsername(), pack.size(), especial, pityAntes, pityDespues, saldoRestante);

        return dtoDesdeApertura(usuario, apertura);
    }

    @Transactional
    public CofreDiarioDto reclamarCofreDiario(Usuario usuario) {
        LocalDate hoy = LocalDate.now(clock);
        String referencia = cofreReferencia(hoy);
        MonederoService.ResultadoCredito credito =
                monederoService.acreditar(usuario, MotivoMovimiento.COFRE_DIARIO,
                        referencia, cofreDiarioMoneda);
        if (credito.aplicado()) {
            auditLogService.registrar(
                    AuditEvento.MONEDA_GANADA,
                    usuario,
                    Map.of(
                            "motivo", MotivoMovimiento.COFRE_DIARIO.name(),
                            "delta", cofreDiarioMoneda,
                            "referencia", referencia,
                            "saldo", credito.saldo()),
                    null);
        }
        return new CofreDiarioDto(credito.aplicado(), cofreDiarioMoneda, credito.saldo(), hoy.toString());
    }

    /**
     * Abre el sobre de bienvenida gratuito (una única vez por cuenta).
     * Garantiza 4 cartas SSR + 1 ESPECIAL sin coste de moneda ni afectar al pity normal.
     */
    @Transactional
    public AbrirSobreResultadoDto reclamarSobreBienvenida(Usuario usuario) {
        String idem = "bienvenida:" + usuario.getId();
        SobreApertura existente = sobreAperturaRepository
                .findByUsuarioAndIdempotencyKey(usuario, idem)
                .orElse(null);
        if (existente != null) {
            return dtoDesdeApertura(usuario, existente);
        }
        if (usuario.getSobreBienvenidaReclamadoEn() != null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "El sobre de bienvenida ya fue reclamado");
        }

        RarezaService.SobreDraw draw = rarezaService.elegirSobre(true);
        long saldo = monederoService.saldoDe(usuario);

        List<Carta> pack = new ArrayList<>(draw.normales());
        pack.add(draw.climax());

        SobreApertura apertura = new SobreApertura(usuario, idem);
        apertura.setPrecio(0L);
        apertura.setPityAntes(0);
        apertura.setEspecial(true);

        long monedasDuplicados = 0L;
        for (int i = 0; i < pack.size(); i++) {
            Carta carta = pack.get(i);
            UsuarioCarta poseida = usuarioCartaRepository.findByUsuarioAndCarta(usuario, carta).orElse(null);
            boolean nueva = poseida == null;
            long recompensa = 0L;
            if (nueva) {
                usuarioCartaRepository.save(new UsuarioCarta(usuario, carta));
            } else {
                poseida.incrementar();
                usuarioCartaRepository.save(poseida);
                recompensa = acreditarDuplicado(usuario, idem, carta, i + 1);
                if (recompensa > 0) {
                    monedasDuplicados += recompensa;
                    saldo += recompensa;
                }
            }
            apertura.addItem(new SobreAperturaItem(carta, i + 1, nueva, recompensa, climaxDe(i, true)));
        }

        apertura.setPityDespues(0);
        apertura.setSaldoRestante(saldo);
        apertura.setMonedasDuplicados(monedasDuplicados);
        apertura = sobreAperturaRepository.save(apertura);

        usuario.setSobreBienvenidaReclamadoEn(java.time.LocalDateTime.now(clock));
        usuarioRepository.save(usuario);

        auditLogService.registrar(
                AuditEvento.SOBRE_BIENVENIDA_RECLAMADO,
                usuario,
                Map.of("cartas", pack.stream()
                        .map(c -> c.getPersonaje().getSlug() + ":" + c.getRareza().name())
                        .toList()),
                null);
        log.info("Sobre bienvenida reclamado: usuario={} cartas={}", usuario.getUsername(), pack.size());
        return dtoDesdeApertura(usuario, apertura);
    }

    private UsuarioCartaPity pityForUpdate(Usuario usuario) {
        return pityRepository.findForUpdateByUsuarioId(usuario.getId())
                .orElseGet(() -> {
                    usuarioRepository.findForUpdateById(usuario.getId())
                            .orElseThrow(() -> new IllegalStateException(
                                    "Usuario no encontrado al crear pity de cartas: " + usuario.getId()));
                    return pityRepository.findForUpdateByUsuarioId(usuario.getId())
                            .orElseGet(() -> pityRepository.saveAndFlush(
                                    new UsuarioCartaPity(entityManager.getReference(Usuario.class, usuario.getId()))));
                });
    }

    private long acreditarDuplicado(Usuario usuario, String idem, Carta carta, int posicion) {
        if (recompensaDuplicado <= 0) {
            return 0L;
        }
        MonederoService.ResultadoCredito credito = monederoService.acreditar(
                usuario,
                MotivoMovimiento.DUPLICADO_CARTA,
                "duplicado:%s:%d:%d".formatted(idem, carta.getId(), posicion),
                recompensaDuplicado);
        return credito.aplicado() ? recompensaDuplicado : 0L;
    }

    private AbrirSobreResultadoDto dtoDesdeApertura(Usuario usuario, SobreApertura apertura) {
        Map<Long, Long> eloPorPersonaje = cartaLecturaCacheService.votosPorPersonaje();
        List<SobreCartaDto> cartas = apertura.getItems().stream()
                .sorted(Comparator.comparingInt(SobreAperturaItem::getPosicion))
                .map(item -> {
                    UsuarioCarta propia = usuarioCartaRepository
                            .findByUsuarioAndCarta(usuario, item.getCarta())
                            .orElse(null);
                    Carta carta = item.getCarta();
                    long elo = eloPorPersonaje.getOrDefault(carta.getPersonaje().getId(), 0L);
                    return new SobreCartaDto(item.getPosicion(), CartaDto.from(carta, propia, elo),
                            item.isNueva(), item.getRecompensaDuplicado(), item.getClimax());
                })
                .toList();
        SobreCartaDto primera = cartas.isEmpty() ? null : cartas.getFirst();
        return new AbrirSobreResultadoDto(
                primera != null ? primera.carta() : null,
                cartas,
                primera != null && primera.nueva(),
                apertura.isEspecial(),
                apertura.getPityAntes(),
                apertura.getPityDespues(),
                apertura.getMonedasDuplicados(),
                apertura.getSaldoRestante(),
                apertura.getPrecio());
    }

    private CartaClimax climaxDe(int index, boolean especial) {
        if (index < CARTAS_REVELADAS - 1) {
            return CartaClimax.NORMAL;
        }
        return especial ? CartaClimax.ESPECIAL : CartaClimax.TOP;
    }

    private List<ColeccionAnimeDto> progresoPorAnime(List<CartaDto> cartas) {
        Map<String, int[]> acumulado = new LinkedHashMap<>();
        for (CartaDto carta : cartas) {
            String anime = carta.anime() != null ? carta.anime() : "Anime";
            int[] stats = acumulado.computeIfAbsent(anime, ignored -> new int[2]);
            stats[0]++;
            if (carta.poseida()) {
                stats[1]++;
            }
        }
        return acumulado.entrySet().stream()
                .map(e -> {
                    int total = e.getValue()[0];
                    int poseidas = e.getValue()[1];
                    int porcentaje = total == 0 ? 0 : (int) Math.round(100.0 * poseidas / total);
                    return new ColeccionAnimeDto(e.getKey(), total, poseidas, porcentaje);
                })
                .sorted(Comparator.comparing(ColeccionAnimeDto::anime))
                .collect(Collectors.toList());
    }

    private boolean cofreDiarioDisponible(Usuario usuario) {
        return !movimientoRepository.existsByUsuarioAndMotivoAndReferencia(
                usuario,
                MotivoMovimiento.COFRE_DIARIO,
                cofreReferencia(LocalDate.now(clock)));
    }

    private static String cofreReferencia(LocalDate fecha) {
        return "cofre:" + fecha;
    }

    private static String normalizarIdempotencyKey(String idempotencyKey) {
        String raw = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (raw.isEmpty()) {
            throw new IllegalArgumentException(
                    "X-Idempotency-Key es obligatorio para abrir sobres");
        }
        String sane = raw.replaceAll("[^A-Za-z0-9._:-]", "-");
        return sane.length() <= 80 ? sane : sane.substring(0, 80);
    }
}
