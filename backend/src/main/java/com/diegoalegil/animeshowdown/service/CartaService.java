package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import com.diegoalegil.animeshowdown.dto.ColeccionPaginaDto;
import com.diegoalegil.animeshowdown.dto.ColeccionResumenDto;
import com.diegoalegil.animeshowdown.dto.RarezaResumenDto;
import com.diegoalegil.animeshowdown.dto.SobreCartaDto;
import com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.CartaClimax;
import com.diegoalegil.animeshowdown.dto.SobreGratisDto;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.SobreApertura;
import com.diegoalegil.animeshowdown.model.SobreAperturaItem;
import com.diegoalegil.animeshowdown.model.SobreGratisCredito;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.model.UsuarioCartaPity;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.MonederoMovimientoRepository;
import com.diegoalegil.animeshowdown.repository.SobreAperturaRepository;
import com.diegoalegil.animeshowdown.repository.SobreGratisCreditoRepository;
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
    private final CartaRepository cartaRepository;
    private final SobreGratisCreditoRepository sobreGratisCreditoRepository;
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
            CartaRepository cartaRepository,
            SobreGratisCreditoRepository sobreGratisCreditoRepository,
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
        this.cartaRepository = cartaRepository;
        this.sobreGratisCreditoRepository = sobreGratisCreditoRepository;
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

        int sobresGratisPendientes = (int) sobreGratisCreditoRepository
                .countByUsuarioIdAndConsumidoEnIsNull(usuario.getId());

        return new ColeccionDto(totalCatalogo, totalPoseidas, porcentaje, saldo,
                pityActual, rarezaService.pityDuro(), cofreDiarioDisponible(usuario),
                usuario.getSobreBienvenidaReclamadoEn() == null, sobresGratisPendientes,
                progresoPorAnime(cartas), cartas);
    }

    /**
     * Galería pública del Salón Legendario: todas las cartas ESPECIAL curadas
     * (arte de autor). Reusa el catálogo cacheado y NO expone posesión — el
     * frontend marca cuáles tiene el usuario con su colección. "Distinguir VER de
     * TENER": cualquiera ve los teasers, el dueño las tiene completas.
     */
    @Transactional(readOnly = true)
    public List<CartaDto> especialesCuradas() {
        return cartaLecturaCacheService.catalogo().stream()
                .filter(c -> c.rareza() == RarezaCarta.ESPECIAL && c.especialCurada())
                .map(c -> CartaDto.from(c, null, 0L))
                .toList();
    }

    /**
     * Resumen de la colección SIN el array de cartas: totales, saldo, pity, flags
     * y agregados por anime y por rareza. Lo consume la cabecera de la página; el
     * grid se pide aparte y paginado con {@link #pagina}. Así una colección de
     * miles de cartas no serializa el catálogo entero en cada visita.
     */
    @Transactional(readOnly = true)
    public ColeccionResumenDto resumen(Usuario usuario) {
        List<CartaCatalogoItem> catalogo = cartaLecturaCacheService.catalogo();
        Set<Long> poseidas = usuarioCartaRepository.findPosesionesByUsuario(usuario).stream()
                .map(UsuarioCartaPosesionItem::cartaId)
                .collect(Collectors.toSet());

        int totalCatalogo = catalogo.size();
        int totalPoseidas = (int) catalogo.stream().filter(c -> poseidas.contains(c.id())).count();
        int porcentaje = totalCatalogo == 0 ? 0 : (int) Math.round(100.0 * totalPoseidas / totalCatalogo);
        long saldo = monederoService.saldoDe(usuario);
        int pityActual = pityRepository.findById(usuario.getId())
                .map(UsuarioCartaPity::getSobresSinEspecial)
                .orElse(0);
        int sobresGratisPendientes = (int) sobreGratisCreditoRepository
                .countByUsuarioIdAndConsumidoEnIsNull(usuario.getId());

        return new ColeccionResumenDto(totalCatalogo, totalPoseidas, porcentaje, saldo,
                pityActual, rarezaService.pityDuro(), cofreDiarioDisponible(usuario),
                usuario.getSobreBienvenidaReclamadoEn() == null, sobresGratisPendientes,
                progresoPorAnimeDeCatalogo(catalogo, poseidas),
                progresoPorRarezaDeCatalogo(catalogo, poseidas));
    }

    /**
     * Una página del grid de colección, filtrada por rareza y/o anime y troceada
     * por offset/limit sobre el catálogo cacheado (sin tocar BBDD más allá de la
     * posesión del usuario). Reemplaza el filtrado y la paginación que el frontend
     * hacía en cliente sobre el array completo.
     */
    @Transactional(readOnly = true)
    public ColeccionPaginaDto pagina(Usuario usuario, RarezaCarta rareza, String anime,
            String orden, int offset, int limit) {
        List<CartaCatalogoItem> catalogo = cartaLecturaCacheService.catalogo();
        Map<Long, Long> eloPorPersonaje = cartaLecturaCacheService.votosPorPersonaje();
        Map<Long, UsuarioCartaPosesionItem> porCartaId = new HashMap<>();
        for (UsuarioCartaPosesionItem uc : usuarioCartaRepository.findPosesionesByUsuario(usuario)) {
            porCartaId.put(uc.cartaId(), uc);
        }

        String animeFiltro = (anime == null || anime.isBlank()) ? null : anime;
        List<CartaCatalogoItem> filtrado = new java.util.ArrayList<>(catalogo.stream()
                .filter(c -> rareza == null || c.rareza() == rareza)
                .filter(c -> animeFiltro == null || animeFiltro.equals(c.anime()))
                .toList());
        // Orden server-side (la paginación lo es): por defecto POSEIDAS primero
        // (estilo colección "las que ya tienes" arriba, el resto en gris), o por
        // anime / rareza / ELO / nombre según el parámetro.
        filtrado.sort(comparadorColeccion(orden, porCartaId, eloPorPersonaje));

        int totalFiltrado = filtrado.size();
        int saneLimit = Math.max(1, limit);
        int from = Math.min(Math.max(0, offset), totalFiltrado);
        int to = Math.min(from + saneLimit, totalFiltrado);
        List<CartaDto> cartas = filtrado.subList(from, to).stream()
                .map(c -> CartaDto.from(c, porCartaId.get(c.id()),
                        eloPorPersonaje.getOrDefault(c.personajeId(), 0L)))
                .toList();
        return new ColeccionPaginaDto(cartas, from, saneLimit, totalFiltrado, to < totalFiltrado);
    }

    /** Comparador del grid de colección según el parámetro `orden`. */
    private static java.util.Comparator<CartaCatalogoItem> comparadorColeccion(
            String orden,
            Map<Long, UsuarioCartaPosesionItem> porCartaId,
            Map<Long, Long> eloPorPersonaje) {
        java.util.Comparator<CartaCatalogoItem> porAnime = java.util.Comparator.comparing(
                c -> c.anime() == null ? "" : c.anime(), String.CASE_INSENSITIVE_ORDER);
        java.util.Comparator<CartaCatalogoItem> porNombre = java.util.Comparator.comparing(
                c -> c.personajeNombre() == null ? "" : c.personajeNombre(), String.CASE_INSENSITIVE_ORDER);
        java.util.Comparator<CartaCatalogoItem> porId = java.util.Comparator.comparing(CartaCatalogoItem::id);
        String o = orden == null ? "" : orden.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (o) {
            case "ANIME" -> porAnime.thenComparing(porNombre).thenComparing(porId);
            case "NOMBRE" -> porNombre.thenComparing(porId);
            case "RAREZA" -> java.util.Comparator
                    .comparingInt((CartaCatalogoItem c) -> c.rareza() == RarezaCarta.ESPECIAL ? 0 : 1)
                    .thenComparing(porAnime).thenComparing(porNombre).thenComparing(porId);
            case "ELO" -> java.util.Comparator
                    .comparingLong((CartaCatalogoItem c) -> -eloPorPersonaje.getOrDefault(c.personajeId(), 0L))
                    .thenComparing(porNombre).thenComparing(porId);
            // POSEIDAS (default): las que YA TIENES primero, luego anime y nombre.
            default -> java.util.Comparator
                    .comparingInt((CartaCatalogoItem c) -> porCartaId.containsKey(c.id()) ? 0 : 1)
                    .thenComparing(porAnime).thenComparing(porNombre).thenComparing(porId);
        };
    }

    private List<ColeccionAnimeDto> progresoPorAnimeDeCatalogo(
            List<CartaCatalogoItem> catalogo, Set<Long> poseidas) {
        Map<String, int[]> acumulado = new LinkedHashMap<>();
        for (CartaCatalogoItem carta : catalogo) {
            String anime = carta.anime() != null ? carta.anime() : "Anime";
            int[] stats = acumulado.computeIfAbsent(anime, ignored -> new int[2]);
            stats[0]++;
            if (poseidas.contains(carta.id())) {
                stats[1]++;
            }
        }
        return acumulado.entrySet().stream()
                .map(e -> {
                    int total = e.getValue()[0];
                    int poseidasAnime = e.getValue()[1];
                    int porcentaje = total == 0 ? 0 : (int) Math.round(100.0 * poseidasAnime / total);
                    return new ColeccionAnimeDto(e.getKey(), total, poseidasAnime, porcentaje);
                })
                .sorted(Comparator.comparing(ColeccionAnimeDto::anime))
                .collect(Collectors.toList());
    }

    private List<RarezaResumenDto> progresoPorRarezaDeCatalogo(
            List<CartaCatalogoItem> catalogo, Set<Long> poseidas) {
        Map<RarezaCarta, int[]> acumulado = new EnumMap<>(RarezaCarta.class);
        for (CartaCatalogoItem carta : catalogo) {
            int[] stats = acumulado.computeIfAbsent(carta.rareza(), ignored -> new int[2]);
            stats[0]++;
            if (poseidas.contains(carta.id())) {
                stats[1]++;
            }
        }
        return acumulado.entrySet().stream()
                .map(e -> new RarezaResumenDto(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList();
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

        long monedasDuplicados = aplicarPack(usuario, idem, pack, apertura, especial);
        saldoRestante += monedasDuplicados;

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
    public AbrirSobreResultadoDto reclamarSobreBienvenida(Usuario usuarioParam) {
        // Lock pesimista sobre el usuario: dos requests simultáneas (doble
        // click, doble pestaña) pasaban ambas el chequeo de "no reclamado" y
        // la segunda reventaba con 409 del unique de idempotency. Con el lock,
        // la segunda espera y recibe la apertura existente.
        Usuario usuario = usuarioRepository.findForUpdateById(usuarioParam.getId())
                .orElse(usuarioParam);
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
        // El flag debe reflejar el contenido real del pack, no asumirse true: si
        // por lo que sea no sale ninguna ESPECIAL, marcarla mentía al registro y
        // a la UI (la celebración de "¡Especial!" se mostraría sin carta especial).
        apertura.setEspecial(pack.stream().anyMatch(c -> c.getRareza() == RarezaCarta.ESPECIAL));

        long monedasDuplicados = aplicarPack(usuario, idem, pack, apertura, true);
        saldo += monedasDuplicados;

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

    /**
     * Concede la carta ESPECIAL de un personaje (por slug) a un usuario, como
     * premio de evento. Si ya la tiene, incrementa el contador. Devuelve la
     * carta concedida o {@code null} si el slug no tiene carta especial.
     */
    @Transactional
    public Carta concederCartaEspecialPorSlug(Usuario usuario, String personajeSlug) {
        if (personajeSlug == null || personajeSlug.isBlank()) {
            return null;
        }
        // Sin exigir variante="": un personaje cuya ESPECIAL tiene variante no
        // vacía (p.ej. ":6-caminos") fallaba el premio de evento devolviendo null.
        Carta carta = cartaRepository
                .findFirstByPersonajeSlugAndRarezaOrderByVarianteAsc(personajeSlug, RarezaCarta.ESPECIAL)
                .orElse(null);
        if (carta == null) {
            log.warn("Recompensa de evento: no existe carta ESPECIAL para slug={}", personajeSlug);
            return null;
        }
        registrarPosesion(usuario, carta);
        return carta;
    }

    /**
     * Otorga un crédito de sobre gratis (idempotente por {@code referencia}).
     * Devuelve true si lo creó, false si ya existía.
     */
    @Transactional
    public boolean otorgarCreditoSobre(Long usuarioId, String origen, String referencia, String etiqueta) {
        if (sobreGratisCreditoRepository.existsByReferencia(referencia)) {
            return false;
        }
        try {
            sobreGratisCreditoRepository.saveAndFlush(
                    new SobreGratisCredito(usuarioId, origen, referencia, etiqueta));
            return true;
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Carrera con otra entrega del mismo crédito: el UNIQUE lo blinda.
            return false;
        }
    }

    /** Créditos de sobre gratis pendientes de abrir del usuario. */
    @Transactional(readOnly = true)
    public List<SobreGratisDto> sobresGratisPendientes(Usuario usuario) {
        return sobreGratisCreditoRepository
                .findByUsuarioIdAndConsumidoEnIsNullOrderByCreatedAtDesc(usuario.getId())
                .stream()
                .map(SobreGratisDto::from)
                .toList();
    }

    /**
     * Abre un crédito de sobre gratis: revela 5 cartas sin coste y sin tocar el
     * pity normal. Idempotente — reabrir el mismo crédito devuelve la apertura ya
     * persistida. 404 si el crédito no es del usuario; 409 si ya estaba consumido.
     */
    @Transactional
    public AbrirSobreResultadoDto abrirSobreGratis(Usuario usuario, Long creditoId) {
        String idem = "sobregratis:" + creditoId;
        SobreApertura existente = sobreAperturaRepository
                .findByUsuarioAndIdempotencyKey(usuario, idem)
                .orElse(null);
        if (existente != null) {
            return dtoDesdeApertura(usuario, existente);
        }

        SobreGratisCredito credito = sobreGratisCreditoRepository.findForUpdateById(creditoId).orElse(null);
        if (credito == null || !credito.getUsuarioId().equals(usuario.getId())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Crédito de sobre no encontrado");
        }
        if (credito.getConsumidoEn() != null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Este sobre gratis ya fue abierto");
        }
        credito.setConsumidoEn(java.time.LocalDateTime.now(clock));
        sobreGratisCreditoRepository.save(credito);

        RarezaService.SobreDraw draw = rarezaService.elegirSobre(false);
        boolean especial = draw.especial();
        long saldo = monederoService.saldoDe(usuario);

        List<Carta> pack = new ArrayList<>(draw.normales());
        pack.add(draw.climax());

        SobreApertura apertura = new SobreApertura(usuario, idem);
        apertura.setPrecio(0L);
        apertura.setPityAntes(0);
        apertura.setEspecial(especial);

        long monedasDuplicados = aplicarPack(usuario, idem, pack, apertura, especial);
        saldo += monedasDuplicados;

        apertura.setPityDespues(0);
        apertura.setSaldoRestante(saldo);
        apertura.setMonedasDuplicados(monedasDuplicados);
        apertura = sobreAperturaRepository.save(apertura);

        auditLogService.registrar(
                AuditEvento.SOBRE_GRATIS_ABIERTO,
                usuario,
                Map.of(
                        "credito", creditoId,
                        "origen", credito.getOrigen(),
                        "cartas", pack.stream()
                                .map(c -> c.getPersonaje().getSlug() + ":" + c.getRareza().name())
                                .toList()),
                null);
        log.info("Sobre gratis abierto: usuario={} credito={} origen={} cartas={}",
                usuario.getUsername(), creditoId, credito.getOrigen(), pack.size());
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

    /**
     * Registra que el usuario posee la carta. Si ya la tenía, incrementa la
     * cantidad con un UPDATE atómico en BD; si es nueva, crea la fila. Devuelve
     * {@code true} si la carta es nueva para el usuario, {@code false} si ya la
     * poseía. Al ser el incremento atómico (y no un read-modify-write), dos
     * concesiones concurrentes de la misma carta sobre el mismo usuario no pierden
     * incrementos. La carrera de la PRIMERA copia concurrente (ambas crean la
     * fila) sigue resolviéndose por el UNIQUE {@code uk_usuario_carta}: una gana y
     * la otra recibe el conflicto, igual que antes.
     */
    /**
     * Aplica un pack de cartas a la colección del usuario y devuelve las monedas
     * acreditadas por duplicados. Núcleo común de {@code abrirSobre},
     * {@code reclamarSobreBienvenida} y {@code abrirSobreGratis}: por cada carta
     * registra la posesión, acredita el duplicado (idempotente por {@code idem} +
     * posición) y añade el ítem a la apertura con su nivel de clímax. El llamante
     * suma el retorno a su saldo (antes cada bucle lo acumulaba inline; es
     * equivalente porque el saldo solo se lee al final de la apertura).
     */
    private long aplicarPack(Usuario usuario, String idem, List<Carta> pack,
            SobreApertura apertura, boolean especial) {
        long monedasDuplicados = 0L;
        for (int i = 0; i < pack.size(); i++) {
            Carta carta = pack.get(i);
            boolean nueva = registrarPosesion(usuario, carta);
            long recompensa = 0L;
            if (!nueva) {
                recompensa = acreditarDuplicado(usuario, idem, carta, i + 1);
                if (recompensa > 0) {
                    monedasDuplicados += recompensa;
                }
            }
            apertura.addItem(new SobreAperturaItem(carta, i + 1, nueva,
                    recompensa, climaxDe(i, especial)));
        }
        return monedasDuplicados;
    }

    private boolean registrarPosesion(Usuario usuario, Carta carta) {
        if (usuarioCartaRepository.incrementarCantidad(usuario, carta) > 0) {
            return false;
        }
        // Insert atómico idempotente (ON CONFLICT DO NOTHING) en vez de save():
        // si otra apertura concurrente del mismo usuario+carta insertó primero,
        // un save() chocaría con uk_usuario_carta lanzando un DIV que reventaría
        // con 500 y envenenaría la tx de apertura. Aquí no lanza: 1 fila = la
        // creamos nosotros (NUEVA); 0 filas = ya existía por la carrera.
        if (usuarioCartaRepository.insertarPosesionSiFalta(usuario.getId(), carta.getId()) > 0) {
            return true;
        }
        // Carrera: otra apertura la creó entre el incrementar y el insert. Ahora
        // sí existe, así que la incrementamos (UPDATE atómico, sin lost-update) y
        // la tratamos como duplicado, no como nueva.
        usuarioCartaRepository.incrementarCantidad(usuario, carta);
        return false;
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
