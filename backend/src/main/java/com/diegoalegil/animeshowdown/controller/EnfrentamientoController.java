package com.diegoalegil.animeshowdown.controller;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.BracketUpdateEvent;
import com.diegoalegil.animeshowdown.dto.CategoriaVotoRequest;
import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.PersonajeMiniDto;
import com.diegoalegil.animeshowdown.dto.RankingDeltaEvent;
import com.diegoalegil.animeshowdown.dto.VotoEnfrentamientoRequest;
import com.diegoalegil.animeshowdown.dto.VotoRegistradoDto;
import com.diegoalegil.animeshowdown.event.EnfrentamientoVotadoEvent;
import com.diegoalegil.animeshowdown.event.VotoAgregadoEvent;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.event.VotoScoreEvent;
import com.diegoalegil.animeshowdown.model.CategoriaVoto;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import com.diegoalegil.animeshowdown.security.AnonymousAbuseThrottleService;
import com.diegoalegil.animeshowdown.security.AnonymousIdentityService;
import com.diegoalegil.animeshowdown.security.ClientIpExtractor;
import com.diegoalegil.animeshowdown.security.TurnstileVerifierService;
import com.diegoalegil.animeshowdown.service.AnimeShowdownMetrics;
import com.diegoalegil.animeshowdown.service.DropService;
import com.diegoalegil.animeshowdown.service.VotoStatsService;
import com.diegoalegil.animeshowdown.service.VotoStatsService.VotoStatsSnapshot;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/enfrentamientos")
@Tag(name = "Enfrentamientos", description = "Duelos 1v1 para votar: siguiente emparejamiento, aleatorio y registro de voto.")
public class EnfrentamientoController {

    private static final Logger log = LoggerFactory.getLogger(EnfrentamientoController.class);
    /** Header con el token Turnstile cuando el frontend completó captcha. */
    private static final String CAPTCHA_TOKEN_HEADER = "X-AS-Captcha-Token";
    private static final int ANON_VOTE_LIMIT = 5;
    private static final int SIGUIENTES_MAX = 10;
    private static final BigDecimal ANON_VOTE_WEIGHT = new BigDecimal("0.30");
    private static final BigDecimal HALF_VOTE_WEIGHT = new BigDecimal("0.50");

    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;
    private final SimpMessagingTemplate messaging;
    private final ApplicationEventPublisher eventPublisher;
    private final AnimeShowdownMetrics metrics;
    private final VotoStatsService votoStatsService;
    private final AnonymousIdentityService anonymousIdentityService;
    private final TurnstileVerifierService turnstileVerifier;
    private final AnonymousAbuseThrottleService abuseThrottle;
    private final ClientIpExtractor clientIpExtractor;
    private final DropService dropService;
    private final java.time.Clock clock;
    private final String turnstileSitekey;
    private final boolean requiereEmailVerificado;
    // Los advisory locks de Postgres (pg_advisory_xact_lock) no existen en H2
    // (tests). Se gatea por el dialecto real de la datasource: en prod (Postgres)
    // serializa los votos anónimos por sesión; en H2 se omite (los tests del
    // controller no ejercitan la carrera y la query petaría).
    private final boolean advisoryLocksSoportados;

    public EnfrentamientoController(EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository,
            @Autowired(required = false) SimpMessagingTemplate messaging,
            ApplicationEventPublisher eventPublisher,
            AnimeShowdownMetrics metrics,
            VotoStatsService votoStatsService,
            AnonymousIdentityService anonymousIdentityService,
            TurnstileVerifierService turnstileVerifier,
            AnonymousAbuseThrottleService abuseThrottle,
            ClientIpExtractor clientIpExtractor,
            DropService dropService,
            java.time.Clock clock,
            @Value("${app.turnstile.sitekey:}") String turnstileSitekey,
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${app.email-verification.required-to-vote:true}") boolean requiereEmailVerificado) {
        this.advisoryLocksSoportados = datasourceUrl != null && datasourceUrl.contains("postgresql");
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
        this.messaging = messaging;
        this.eventPublisher = eventPublisher;
        this.votoStatsService = votoStatsService;
        this.anonymousIdentityService = anonymousIdentityService;
        this.turnstileVerifier = turnstileVerifier;
        this.abuseThrottle = abuseThrottle;
        this.clientIpExtractor = clientIpExtractor;
        this.dropService = dropService;
        this.clock = clock;
        this.turnstileSitekey = turnstileSitekey == null ? "" : turnstileSitekey.trim();
        this.metrics = metrics;
        this.requiereEmailVerificado = requiereEmailVerificado;
    }

    /**
     * Devuelve el siguiente enfrentamiento abierto para el visitante actual.
     *
     * <p>Contrato hot-path de VotarPage: el servidor excluye matches ya votados
     * por el usuario autenticado o por la identidad anónima, y el cliente puede
     * añadir ids vistos en esta sesión. El muestreo usa cursor por id con
     * fallback circular; evita el coste de ordenar aleatoriamente la tabla y que
     * el frontend haga varios refetches hasta esquivar duplicados.
     */
    @GetMapping("/siguiente")
    public ResponseEntity<EnfrentamientoDto> siguiente(
            @RequestParam(name = "excludeIds", required = false) List<String> rawExcludeIds,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        AnonymousVoteContext anon = usuario == null ? resolverAnonymousContext(httpRequest) : null;
        List<Long> excludeIds = parseExcludeIds(rawExcludeIds);
        Optional<Enfrentamiento> siguiente = buscarSiguienteDisponible(
                usuario == null ? null : usuario.getId(),
                anon == null ? null : anon.sessionId(),
                excludeIds);
        if (siguiente.isEmpty()) {
            ResponseEntity.BodyBuilder notFound = ResponseEntity.status(HttpStatus.NOT_FOUND);
            if (anon != null && anon.signedToken() != null) {
                notFound.header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString());
            }
            return notFound.build();
        }
        ResponseEntity.BodyBuilder ok = ResponseEntity.ok();
        if (anon != null && anon.signedToken() != null) {
            ok.header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString());
        }
        return ok.body(EnfrentamientoDto.from(siguiente.get(), null));
    }

    /**
     * Alias legacy para consumidores que aún llaman /aleatorio. Mantiene la
     * respuesta pero delega en el contrato server-authoritative nuevo.
     */
    @GetMapping("/aleatorio")
    @Operation(summary = "Duelo aleatorio",
            description = "Devuelve un enfrentamiento 1v1 aleatorio para votar. Funciona con o sin sesión.")
    public ResponseEntity<EnfrentamientoDto> aleatorio(
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        return siguiente(null, usuario, httpRequest);
    }

    /**
     * Versión EN LOTE de /siguiente: devuelve hasta {@code count} enfrentamientos
     * abiertos distintos en UNA llamada para que VotarPage mantenga una cola en
     * cliente y no haga un round-trip a la DB por cada voto (el /siguiente medía
     * ~1s por llamada). Mismo contrato de exclusión que /siguiente (excluye los
     * ya votados por el usuario/sesión + los excludeIds del cliente). Devuelve
     * lista vacía (200, no 404) cuando el pool está agotado.
     */
    @GetMapping("/siguientes")
    public ResponseEntity<List<EnfrentamientoDto>> siguientes(
            @RequestParam(name = "count", required = false, defaultValue = "5") int count,
            @RequestParam(name = "excludeIds", required = false) List<String> rawExcludeIds,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {
        AnonymousVoteContext anon = usuario == null ? resolverAnonymousContext(httpRequest) : null;
        int n = Math.max(1, Math.min(SIGUIENTES_MAX, count));
        List<Long> excludeIds = parseExcludeIds(rawExcludeIds);
        List<EnfrentamientoDto> lote = buscarSiguientesDisponibles(
                usuario == null ? null : usuario.getId(),
                anon == null ? null : anon.sessionId(),
                excludeIds, n);
        ResponseEntity.BodyBuilder ok = ResponseEntity.ok();
        if (anon != null && anon.signedToken() != null) {
            ok.header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString());
        }
        return ok.body(lote);
    }

    private List<EnfrentamientoDto> buscarSiguientesDisponibles(
            Long usuarioId, String anonSessionId, List<Long> excludeIds, int count) {
        long maxOpenId = enfrentamientoRepository.maxIdEnfrentamientoAbierto();
        if (maxOpenId <= 0) return List.of();
        long cursor = ThreadLocalRandom.current().nextLong(1, maxOpenId + 1);
        List<Long> safeExcludeIds = excludeIds.isEmpty() ? Collections.singletonList(-1L) : excludeIds;
        int excludeIdsSize = excludeIds.size();

        // Cursor aleatorio + wrap-around (igual que /siguiente) para variedad sin
        // ORDER BY RANDOM(). LinkedHashSet preserva orden y deduplica.
        java.util.LinkedHashSet<Long> ids = new java.util.LinkedHashSet<>(
                enfrentamientoRepository.findIdsSiguientesAbiertosDesde(
                        cursor, usuarioId, anonSessionId, safeExcludeIds, excludeIdsSize, count));
        if (ids.size() < count) {
            ids.addAll(enfrentamientoRepository.findIdsSiguientesAbiertosAntes(
                    cursor, usuarioId, anonSessionId, safeExcludeIds, excludeIdsSize, count - ids.size()));
        }
        if (ids.isEmpty()) return List.of();

        java.util.Map<Long, Enfrentamiento> porId = enfrentamientoRepository
                .findByIdInFetch(new java.util.ArrayList<>(ids)).stream()
                .collect(java.util.stream.Collectors.toMap(Enfrentamiento::getId, e -> e));
        return ids.stream()
                .map(porId::get)
                .filter(Objects::nonNull)
                .map(e -> EnfrentamientoDto.from(e, null))
                .toList();
    }

    // @Transactional es OBLIGATORIO aquí, no estético.
    // Sin él, votoRepository.save() corre en auto-commit (su propia tx), y
    // cuando llega `eventPublisher.publishEvent(new VotoRegistradoEvent(...))`
    // ya no hay tx activa. BadgeEventListener escucha en AFTER_COMMIT, que sin
    // tx por defecto descarta el evento silenciosamente → badges como
    // primer_voto / cien_votos / mil_votos nunca se desbloquean por el flujo
    // real, solo por desbloqueo manual desde BadgeService. spring.jpa.open-in-view
    // está off, así que el filtro web tampoco abre una tx implícita.
    @PostMapping("/{id}/votar")
    @Transactional
    // Sin @CacheEvict por voto: antes 5x @CacheEvict(allEntries=true) vaciaban
    // los rankings en CADA voto → bajo carga la caché quedaba siempre fría y el
    // siguiente /ranking recomputaba todo (estampida). Esas cachés ya se
    // auto-refrescan por TTL (votos-ranking/cartas-votos-score 30s,
    // ranking-movimientos 1min, similares 5min, elo-history 1h) y el ranking en
    // vivo se mueve por RankingDeltaEvent (WS), no por refetch del REST. La
    // staleness máxima (≤TTL) es el presupuesto de coherencia ya elegido.
    public ResponseEntity<?> votar(@PathVariable Long id,
            @Valid @RequestBody VotoEnfrentamientoRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {

        Optional<Enfrentamiento> enfOpt = enfrentamientoRepository.findByIdForUpdate(id);
        if (enfOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Enfrentamiento enf = enfOpt.get();

        if (enf.getTorneo().getEstado() != EstadoTorneo.IN_PROGRESS) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Solo se puede votar en enfrentamientos de torneos IN_PROGRESS");
        }

        // antes solo se validaba el estado del torneo.
        // Por id directo el cliente podía votar:
        //  - Matches ya resueltos (ganador != null): votos inflados sobre un
        //    resultado cerrado, afectando counts post-bracket y stats.
        //  - Matches de R2+ todavía sin participantes propagados (personaje1
        //    o 2 null): NullPointerException al hacer.getId() abajo → 500.
        // Ambos rechazados explícitamente con 409 + mensaje claro.
        if (enf.getGanador() != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Este enfrentamiento ya está cerrado");
        }
        if (enf.getPersonaje1() == null || enf.getPersonaje2() == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Este enfrentamiento aún no tiene participantes asignados (ronda futura del bracket)");
        }

        // Usuarios PENDIENTE de verificación de email no
        // pueden votar. Toggle vía app.email-verification.required-to-vote
        // (true en prod, false en tests para no obligar al fixture a
        // simular el flujo completo de email). 403 con mensaje claro.
        AnonymousVoteContext anon = usuario == null ? resolverAnonymousContext(httpRequest) : null;

        if (usuario != null && requiereEmailVerificado && !usuario.estaVerificado()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Necesitas verificar tu email antes de votar. Revisa tu bandeja de entrada.");
        }

        boolean empate = request.empate();
        Long ganadorId = request.personajeGanadorId();
        Personaje ganador = null;
        if (!empate) {
            if (ganadorId == null) {
                return ResponseEntity.badRequest()
                        .body("personajeGanadorId es obligatorio");
            }
            if (enf.getPersonaje1().getId().equals(ganadorId)) {
                ganador = enf.getPersonaje1();
            } else if (enf.getPersonaje2().getId().equals(ganadorId)) {
                ganador = enf.getPersonaje2();
            } else {
                return ResponseEntity.badRequest()
                        .body("El personaje no pertenece a este enfrentamiento");
            }
        }

        long votosAnonimosUsados = 0;
        if (usuario != null) {
            if (votoRepository.existsByEnfrentamientoAndUsuario(enf, usuario)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body("Ya has votado este enfrentamiento");
            }
        } else {
            // antifraude antes del check
            // de 5 votos invitados. El throttle protege contra abusos que
            // rotan la cookie (medidos por anon_ip_hash); el límite de 5
            // sigue siendo el gate para empujar al CTA de "crea cuenta".
            String captchaToken = httpRequest.getHeader(CAPTCHA_TOKEN_HEADER);
            boolean captchaValido = false;
            if (captchaToken != null && !captchaToken.isBlank()) {
                String ip = clientIpExtractor.extract(httpRequest);
                captchaValido = turnstileVerifier.verify(captchaToken, ip);
            }
            var decision = abuseThrottle.decide(anon.sessionId(), anon.ipHash(), captchaValido);
            if (decision == AnonymousAbuseThrottleService.Decision.BLOCKED_24H) {
                ResponseEntity.BodyBuilder blocked = ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .header(HttpHeaders.RETRY_AFTER, "86400");
                return withAnonCookie(blocked, anon).body(java.util.Map.of(
                                "message", "Demasiados votos anónimos en las últimas 24h desde tu red. Vuelve mañana o crea cuenta gratis.",
                                "retryAfterSeconds", 86400));
            }
            if (decision == AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA) {
                // 428 Precondition Required: el cliente DEBE resolver el
                // captcha antes de reintentar. sitekey en el body para que
                // el frontend monte el widget Turnstile sin saber a priori
                // el provider.
                return withAnonCookie(ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED), anon)
                        .body(java.util.Map.of(
                                "message", "Verifica que no eres un bot antes de seguir votando.",
                                "captchaRequired", true,
                                "provider", "turnstile",
                                "sitekey", turnstileSitekey));
            }
            // Serializa los votos concurrentes de esta sesión ANTES de contar el
            // tope (solo Postgres; ver VotoRepository.lockSesionAnonima). votar es
            // @Transactional → el lock se libera al cerrar la tx. En H2 se omite.
            if (advisoryLocksSoportados) {
                votoRepository.lockSesionAnonima(anon.sessionId());
            }
            votosAnonimosUsados = votoRepository.countByAnonSessionId(anon.sessionId());
            if (votosAnonimosUsados >= ANON_VOTE_LIMIT) {
                return withAnonCookie(ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS), anon)
                        .body(java.util.Map.of(
                                "message", "Has agotado tus 5 votos invitados. Crea cuenta gratis para seguir votando.",
                                "limite", ANON_VOTE_LIMIT,
                                "votosAnonimosRestantes", 0));
            }
            if (votoRepository.existsByEnfrentamientoAndAnonSessionId(enf, anon.sessionId())) {
                return withAnonCookie(ResponseEntity.status(HttpStatus.CONFLICT), anon)
                        .body("Ya has votado este enfrentamiento como invitado");
            }
        }

        Voto voto = new Voto(empate ? enf.getPersonaje1() : ganador, usuario, enf);
        // Sella el instante del voto desde el Clock inyectado (la única autoridad
        // de tiempo), no desde el LocalDateTime.now() del @PrePersist. Así la fecha
        // del voto, la misión diaria, la racha y el madrugador comparten la misma
        // base temporal testeable, y el sellado de fechaVoto que viaja en el evento
        // refleja el día real del voto (no el del procesamiento @Async).
        voto.setFecha(java.time.LocalDateTime.now(clock));
        voto.setEmpate(empate);
        if (usuario == null) {
            voto.setPeso(empate ? ANON_VOTE_WEIGHT.multiply(HALF_VOTE_WEIGHT) : ANON_VOTE_WEIGHT);
            voto.setAnonSessionId(anon.sessionId());
            voto.setAnonIpHash(anon.ipHash());
        } else if (empate) {
            voto.setPeso(HALF_VOTE_WEIGHT);
        }
        // Intención de voto (feature #15) si el cliente la mandó ya en el POST.
        // fromId tolera null/blank/desconocido → null (voto sin intención),
        // jamás rechaza el voto. Lo normal es que llegue null y se fije luego
        // con el PATCH set-once tras ver el resultado.
        CategoriaVoto categoria = CategoriaVoto.fromId(request.categoria());
        if (categoria != null) {
            voto.setCategoria(categoria.getId());
        }
        // saveAndFlush: el perdedor de la carrera de doble voto (dos POSTs
        // simultáneos que pasaron el check aplicativo a la vez) pega aquí
        // contra el unique de votos, en vez de reventar con 500 al commit —
        // después de haber emitido métricas, deltas WS y eventos de un voto
        // que nunca existió. Se LANZA (no se devuelve) porque el flush fallido
        // marca la tx rollback-only; GlobalExceptionHandler la convierte en el
        // mismo 409 que devuelve el check.
        Voto guardado;
        try {
            guardado = votoRepository.saveAndFlush(voto);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    usuario != null
                            ? "Ya has votado este enfrentamiento"
                            : "Ya has votado este enfrentamiento como invitado");
        }
        metrics.votoRegistrado();
        // Embudo: segmenta el voto por tipo de votante para ver la conversión
        // invitado→registrado (el voto anónimo "vale menos" y no retiene).
        metrics.votoFunnel(usuario == null ? "anonimo" : (empate ? "empate" : "registrado"));
        VotoStatsSnapshot stats = votoStatsService.registrar(guardado);

        Personaje p1 = enf.getPersonaje1();
        Personaje p2 = enf.getPersonaje2();
        double votosP1 = stats.scoreDe(p1);
        double votosP2 = stats.scoreDe(p2);
        Personaje perdedor = empate ? null : (ganador.getId().equals(p1.getId()) ? p2 : p1);
        double votosGanador = empate ? votosP1 : (ganador.getId().equals(p1.getId()) ? votosP1 : votosP2);
        double votosPerdedor = empate ? votosP2 : (perdedor.getId().equals(p1.getId()) ? votosP1 : votosP2);

        // Push del estado actualizado del match al topic del
        // torneo. Los clientes viendo /torneos/{slug} actualizan el bracket
        // sin esperar al polling. Best-effort: si falla no afecta al voto.
        publicarBracketUpdate(enf, p1, votosP1, p2, votosP2);
        // Además del total ponderado pasamos el peso del voto recién registrado.
        // En empates se emite un delta por participante (0.5 visible por lado
        // y peso 0.5 registrado / 0.15 anónimo), así ranking, historial y WS
        // comparten la misma semántica.
        double pesoVotoRegistrado = guardado.getPeso() == null
                ? 1.0
                : guardado.getPeso().doubleValue();
        if (empate) {
            for (var delta : stats.deltas()) {
                var totales = stats.statsDe(delta.personaje());
                publicarRankingDelta(delta.personaje(), totales.votosScore(), totales.pesoVotos(),
                        delta.votosScoreDouble(), delta.pesoVotosDouble());
            }
        } else {
            var totalesGanador = stats.statsDe(ganador);
            publicarRankingDelta(ganador, totalesGanador.votosScore(), totalesGanador.pesoVotos(),
                    1.0, pesoVotoRegistrado);
        }

        // Evento de dominio. BadgeEventListener escucha tras
        // commit y desbloquea badges de umbral (primer_voto/cien/mil).
        // Diseño extensible — futuros listeners podrán reaccionar también.
        // Día del voto SELLADO en la tx del voto (no recalculado en el hilo
        // @Async): un listener que cruce medianoche debe contar el voto en su
        // día REAL, no en el día en que se procese el evento.
        java.time.LocalDate diaVoto = (guardado.getFecha() != null
                ? guardado.getFecha() : java.time.LocalDateTime.now(clock)).toLocalDate();
        if (usuario != null) {
            eventPublisher.publishEvent(new VotoRegistradoEvent(usuario, enf, ganador, diaVoto));
        }
        eventPublisher.publishEvent(new EnfrentamientoVotadoEvent(enf.getTorneo().getId(), enf.getId()));
        // Materialización del score de personaje (V53) fuera de esta transacción:
        // VotoScoreListener la aplica async en AFTER_COMMIT con incremento atómico,
        // así el POST no retiene el lock de la fila del personaje (hot path viral).
        eventPublisher.publishEvent(new VotoScoreEvent(
                empate, guardado.getPersonaje().getId(), p1.getId(), p2.getId()));
        // Agregaciones diaria/por-torneo materializadas async (no las lee el DTO
        // ni el delta WS, solo rankings por ventana cacheados).
        eventPublisher.publishEvent(new VotoAgregadoEvent(
                stats.deltas().stream()
                        .map(d -> new VotoAgregadoEvent.DiaDelta(
                                d.personaje().getId(), d.votosScore(), d.pesoVotos()))
                        .toList(),
                diaVoto,
                enf.getTorneo().getId()));

        Integer votosAnonimosRestantes = null;
        if (usuario == null) {
            votosAnonimosRestantes = Math.max(0,
                    ANON_VOTE_LIMIT - (int) (votosAnonimosUsados + 1));
        }

        // Monedas que este voto va a acreditar (previsualización exacta del drop
        // async, misma regla que CartaDropListener). Solo para usuarios: los
        // invitados no generan drop. La previsualización corre en su propia tx
        // (REQUIRES_NEW), así un fallo de sus lecturas no envenena la tx del voto;
        // el try/catch es una red secundaria que solo oculta el toast.
        long monedasGanadas = 0L;
        if (usuario != null) {
            try {
                monedasGanadas = dropService.previsualizarMonedasVoto(usuario);
            } catch (RuntimeException e) {
                monedasGanadas = 0L;
            }
        }

        VotoRegistradoDto dto = new VotoRegistradoDto(
                guardado.getId(),
                ganador == null ? null : ganador.getId(),
                votosGanador,
                perdedor == null ? null : perdedor.getId(),
                votosPerdedor,
                empate ? 0.0 : (usuario == null ? ANON_VOTE_WEIGHT.doubleValue() : 1.0),
                usuario == null,
                votosAnonimosRestantes,
                empate,
                monedasGanadas);
        ResponseEntity.BodyBuilder ok = ResponseEntity.ok();
        if (usuario == null) ok = withAnonCookie(ok, anon);
        return ok.body(dto);
    }

    /**
     * Fija la intención (categoría) de un voto YA emitido (feature #15).
     *
     * <p>El arena es 1 tap al ganador → el voto se registra al instante. La
     * categoría llega en un SEGUNDO tap opcional, desde el panel de resultado,
     * así que necesita su propio endpoint sobre el voto existente del votante
     * (registrado por usuario, anónimo por sesión).
     *
     * <p><b>Set-once</b>: la categoría se fija UNA sola vez y nunca se cambia —
     * los votos son inmutables. Solo se permite si {@code categoria IS NULL};
     * si ya estaba fijada devolvemos 409 (no re-set). Una categoría
     * blank/desconocida es un no-op idempotente 204 (la intención es opcional,
     * nunca un error duro). Si el votante no tiene voto en este duelo → 404.
     *
     * <p>No crea voto ni toca peso/antifraude — solo anota; por eso no pasa por
     * el throttle anónimo ni el límite de 5 votos invitados.
     */
    @PatchMapping("/{id}/votar/categoria")
    @Transactional
    public ResponseEntity<?> fijarCategoriaVoto(@PathVariable Long id,
            @RequestBody CategoriaVotoRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {

        CategoriaVoto categoria = CategoriaVoto.fromId(request == null ? null : request.categoria());
        if (categoria == null) {
            // Categoría inválida/blank → no-op idempotente. La intención es
            // opcional: nunca devolvemos error por una categoría vacía.
            return ResponseEntity.noContent().build();
        }

        Optional<Enfrentamiento> enfOpt = enfrentamientoRepository.findById(id);
        if (enfOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Enfrentamiento enf = enfOpt.get();

        int filasActualizadas;
        boolean votoExiste;
        if (usuario != null) {
            filasActualizadas = votoRepository.fijarCategoriaRegistradoSiPendiente(
                    enf, usuario, categoria.getId());
            votoExiste = votoRepository.existsByEnfrentamientoAndUsuario(enf, usuario);
        } else {
            AnonymousVoteContext anon = resolverAnonymousContext(httpRequest);
            filasActualizadas = votoRepository.fijarCategoriaAnonimaSiPendiente(
                    enf, anon.sessionId(), categoria.getId());
            votoExiste = votoRepository.existsByEnfrentamientoAndAnonSessionId(enf, anon.sessionId());
        }

        if (filasActualizadas == 1) {
            return ResponseEntity.noContent().build();
        }
        if (!votoExiste) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body("La intención de este voto ya estaba fijada");
    }

    /**
     * Publica un {@link BracketUpdateEvent} al topic público del torneo
     * con los counts ya calculados por el caller (evitamos doble round-trip).
     */
    private void publicarBracketUpdate(Enfrentamiento enf,
            Personaje p1, double v1, Personaje p2, double v2) {
        if (messaging == null) return;
        try {
            BracketUpdateEvent ev = new BracketUpdateEvent(
                    enf.getTorneo().getId(),
                    enf.getId(),
                    p1 == null ? null : p1.getId(),
                    v1,
                    p2 == null ? null : p2.getId(),
                    v2,
                    v1 + v2);
            messaging.convertAndSend("/topic/torneo." + enf.getTorneo().getId() + ".bracket", ev);
            String slug = enf.getTorneo().getSlug();
            if (slug != null && !slug.isBlank()) {
                messaging.convertAndSend("/topic/tournament/" + slug, ev);
            }
        } catch (Exception e) {
            // Best-effort: el voto ya está guardado. El cliente lo verá en
            // el próximo polling 30s del fallback.
            log.warn("Push WS bracket update falló: enf={} err={}",
                    enf.getId(), e.getMessage());
        }
    }

    private void publicarRankingDelta(Personaje personaje, double votosTotales,
            Double pesoTotales, double deltaScore, double deltaPeso) {
        if (messaging == null || personaje == null) return;
        try {
            // payload incluye:
            //   - pesoVotos: total ponderado all-time (para periodo='all').
            //   - deltaPeso: peso del voto recién emitido. El
            //     frontend lo suma a las cachés temporales, evitando
            //     contaminarlas con el total absoluto.
            var ev = new RankingDeltaEvent(PersonajeMiniDto.from(personaje),
                    votosTotales, deltaScore, pesoTotales, deltaPeso);
            messaging.convertAndSend("/topic/ranking-delta", ev);
        } catch (Exception e) {
            log.warn("Push WS ranking delta falló: personaje={} err={}",
                    personaje.getSlug(), e.getMessage());
        }
    }

    /**
     * cookie firmada server-side.
     * Orden de resolución de la identidad anónima:
     *   1. Cookie firmada {@code as_anon} con HMAC verificable.
     *   2. Emitir nuevo token firmado y devolverlo en la respuesta.
     *
     * El campo {@code signedToken} del contexto, si no es null, manda al
     * controller a settear la cookie firmada en la respuesta. No aceptamos
     * identificadores enviados por JS: rotarlos permitía fragmentar el cupo
     * invitado y saltarse la identidad estable del servidor.
     */
    private AnonymousVoteContext resolverAnonymousContext(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (anonymousIdentityService.getCookieName().equals(cookie.getName())) {
                    var verified = anonymousIdentityService.verify(cookie.getValue());
                    if (verified.isPresent()) {
                        String sid = verified.get();
                        // Cookie firmada válida → no reemitir, browser ya
                        // la tiene. signedToken=null evita Set-Cookie extra.
                        return new AnonymousVoteContext(sid, hashAnonimo(request), null);
                    }
                    // Si está manipulada o expirada, caemos al fallback
                    // de emisión nueva.
                }
            }
        }
        // Sin identidad reconocible: emitimos token firmado nuevo.
        String token = anonymousIdentityService.emit();
        var verified = anonymousIdentityService.verify(token);
        String sid = verified.orElseGet(() -> UUID.randomUUID().toString());
        return new AnonymousVoteContext(sid, hashAnonimo(request), token);
    }

    /**
     * Cookie de respuesta para la identidad anónima. Solo se emite cuando el
     * contexto acaba de crear una identidad firmada nueva; si el navegador ya
     * mandó una cookie válida, no añadimos Set-Cookie extra.
     */
    private ResponseCookie anonCookieFor(AnonymousVoteContext context) {
        return anonymousIdentityService.buildCookie(context.signedToken());
    }

    private ResponseEntity.BodyBuilder withAnonCookie(
            ResponseEntity.BodyBuilder builder,
            AnonymousVoteContext context) {
        if (context != null && context.signedToken() != null) {
            builder.header(HttpHeaders.SET_COOKIE, anonCookieFor(context).toString());
        }
        return builder;
    }

    private Optional<Enfrentamiento> buscarSiguienteDisponible(
            Long usuarioId,
            String anonSessionId,
            List<Long> excludeIds) {
        long maxOpenId = enfrentamientoRepository.maxIdEnfrentamientoAbierto();
        if (maxOpenId <= 0) return Optional.empty();

        long cursor = ThreadLocalRandom.current().nextLong(1, maxOpenId + 1);
        List<Long> safeExcludeIds = excludeIds.isEmpty() ? Collections.singletonList(-1L) : excludeIds;
        int excludeIdsSize = excludeIds.size();
        return enfrentamientoRepository.findSiguienteAbiertoDesde(
                cursor, usuarioId, anonSessionId, safeExcludeIds, excludeIdsSize)
                .or(() -> enfrentamientoRepository.findSiguienteAbiertoAntes(
                        cursor, usuarioId, anonSessionId, safeExcludeIds, excludeIdsSize))
                // Las @ManyToOne de Enfrentamiento son LAZY y siguiente() mapea el
                // DTO FUERA de tx (open-in-view=false): las queries nativas de
                // arriba devuelven proxies, así que rehidratamos con JOIN FETCH —
                // igual que /siguientes — antes de cerrar la sesión.
                .flatMap(e -> enfrentamientoRepository.findByIdInFetch(List.of(e.getId()))
                        .stream().findFirst());
    }

    private List<Long> parseExcludeIds(List<String> rawValues) {
        if (rawValues == null || rawValues.isEmpty()) return List.of();
        return rawValues.stream()
                .filter(Objects::nonNull)
                .flatMap(value -> Arrays.stream(value.split(",")))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(this::tryParsePositiveLong)
                .flatMap(Optional::stream)
                .distinct()
                .limit(100)
                .toList();
    }

    private Optional<Long> tryParsePositiveLong(String raw) {
        try {
            long value = Long.parseLong(raw);
            return value > 0 ? Optional.of(value) : Optional.empty();
        } catch (NumberFormatException ignored) {
            return Optional.empty();
        }
    }

    /**
     * Clave server-side del throttle anti-fraude: hash de la IP REAL del
     * cliente + User-Agent. A propósito NO incluye la sesión anónima ni el
     * header de fingerprint — ambos los controla el cliente, y meterlos en
     * el hash permitía que rotar la cookie (o el fingerprint) por petición
     * fragmentara el bucket y evadiera el conteo por IP. La IP sale de
     * {@link ClientIpExtractor} (respeta la cadena de proxy de confianza),
     * no de un X-Forwarded-For crudo y spoofeable.
     */
    private String hashAnonimo(HttpServletRequest request) {
        String ip = clientIpExtractor.extract(request);
        String ua = Optional.ofNullable(request.getHeader("User-Agent")).orElse("");
        String raw = ip + "|" + ua;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(raw.hashCode());
        }
    }

    private record AnonymousVoteContext(String sessionId, String ipHash, String signedToken) {}
}
