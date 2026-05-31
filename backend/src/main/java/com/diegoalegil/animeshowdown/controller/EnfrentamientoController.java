package com.diegoalegil.animeshowdown.controller;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.BracketUpdateEvent;
import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.PersonajeMiniDto;
import com.diegoalegil.animeshowdown.dto.RankingDeltaEvent;
import com.diegoalegil.animeshowdown.dto.CategoriaVotoRequest;
import com.diegoalegil.animeshowdown.dto.VotoEnfrentamientoRequest;
import com.diegoalegil.animeshowdown.dto.VotoRegistradoDto;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
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

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.beans.factory.annotation.Value;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/enfrentamientos")
public class EnfrentamientoController {

    private static final Logger log = LoggerFactory.getLogger(EnfrentamientoController.class);
    private static final String ANON_COOKIE = "as_anon_vote_id";
    private static final String ANON_ID_HEADER = "X-AS-Anonymous-Id";
    /** Header con el token Turnstile cuando el frontend completó captcha. */
    private static final String CAPTCHA_TOKEN_HEADER = "X-AS-Captcha-Token";
    private static final Pattern ANON_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{12,64}$");
    private static final int ANON_VOTE_LIMIT = 5;
    private static final BigDecimal ANON_VOTE_WEIGHT = new BigDecimal("0.30");
    private static final BigDecimal HALF_VOTE_WEIGHT = new BigDecimal("0.50");

    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;
    private final SimpMessagingTemplate messaging;
    private final ApplicationEventPublisher eventPublisher;
    private final AnimeShowdownMetrics metrics;
    private final AnonymousIdentityService anonymousIdentityService;
    private final TurnstileVerifierService turnstileVerifier;
    private final AnonymousAbuseThrottleService abuseThrottle;
    private final ClientIpExtractor clientIpExtractor;
    private final String turnstileSitekey;
    private final boolean requiereEmailVerificado;
    private final boolean cookieSecure;

    public EnfrentamientoController(EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository,
            @Autowired(required = false) SimpMessagingTemplate messaging,
            ApplicationEventPublisher eventPublisher,
            AnimeShowdownMetrics metrics,
            AnonymousIdentityService anonymousIdentityService,
            TurnstileVerifierService turnstileVerifier,
            AnonymousAbuseThrottleService abuseThrottle,
            ClientIpExtractor clientIpExtractor,
            @Value("${app.turnstile.sitekey:}") String turnstileSitekey,
            @Value("${app.email-verification.required-to-vote:true}") boolean requiereEmailVerificado,
            @Value("${app.refresh-token.cookie-secure:true}") boolean cookieSecure) {
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
        this.messaging = messaging;
        this.eventPublisher = eventPublisher;
        this.anonymousIdentityService = anonymousIdentityService;
        this.turnstileVerifier = turnstileVerifier;
        this.abuseThrottle = abuseThrottle;
        this.clientIpExtractor = clientIpExtractor;
        this.turnstileSitekey = turnstileSitekey == null ? "" : turnstileSitekey.trim();
        this.metrics = metrics;
        this.requiereEmailVerificado = requiereEmailVerificado;
        this.cookieSecure = cookieSecure;
    }

    /**
     * Devuelve un enfrentamiento "abierto" aleatorio (de un torneo
     * IN_PROGRESS, con ambos personajes y sin ganador) para que VotarPage
     * pueda mostrarlo en modo backend. 404 si ahora mismo no hay matches
     * abiertos — el frontend hace fallback a modo casual con pares random
     * locales.
     */
    @GetMapping("/aleatorio")
    public ResponseEntity<EnfrentamientoDto> aleatorio() {
        return enfrentamientoRepository.findEnfrentamientoAbiertoAleatorio()
                .map(e -> ResponseEntity.ok(EnfrentamientoDto.from(e, null)))
                .orElseGet(() -> ResponseEntity.notFound().build());
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
    @Caching(evict = {
            @CacheEvict(value = "votos-ranking", allEntries = true),
            @CacheEvict(value = "ranking-movimientos", allEntries = true),
            @CacheEvict(value = "personaje-elo-history", allEntries = true),
            @CacheEvict(value = "personajes-similares", allEntries = true)
    })
    public ResponseEntity<?> votar(@PathVariable Long id,
            @Valid @RequestBody VotoEnfrentamientoRequest request,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest httpRequest) {

        Optional<Enfrentamiento> enfOpt = enfrentamientoRepository.findById(id);
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

        boolean empate = request.isEmpate();
        Long ganadorId = request.getPersonajeGanadorId();
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
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .header(HttpHeaders.RETRY_AFTER, "86400")
                        .header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString())
                        .body(java.util.Map.of(
                                "message", "Demasiados votos anónimos en las últimas 24h desde tu red. Vuelve mañana o crea cuenta gratis.",
                                "retryAfterSeconds", 86400));
            }
            if (decision == AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA) {
                // 428 Precondition Required: el cliente DEBE resolver el
                // captcha antes de reintentar. sitekey en el body para que
                // el frontend monte el widget Turnstile sin saber a priori
                // el provider.
                return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                        .header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString())
                        .body(java.util.Map.of(
                                "message", "Verifica que no eres un bot antes de seguir votando.",
                                "captchaRequired", true,
                                "provider", "turnstile",
                                "sitekey", turnstileSitekey));
            }
            long votosAnonimosUsados = votoRepository.countByAnonSessionId(anon.sessionId());
            if (votosAnonimosUsados >= ANON_VOTE_LIMIT) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString())
                        .body(java.util.Map.of(
                                "message", "Has agotado tus 5 votos invitados. Crea cuenta gratis para seguir votando.",
                                "limite", ANON_VOTE_LIMIT,
                                "votosAnonimosRestantes", 0));
            }
            if (votoRepository.existsByEnfrentamientoAndAnonSessionId(enf, anon.sessionId())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString())
                        .body("Ya has votado este enfrentamiento como invitado");
            }
        }

        Voto voto = new Voto(empate ? enf.getPersonaje1() : ganador, usuario, enf);
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
        CategoriaVoto categoria = CategoriaVoto.fromId(request.getCategoria());
        if (categoria != null) {
            voto.setCategoria(categoria.getId());
        }
        Voto guardado = votoRepository.save(voto);
        metrics.votoRegistrado();

        Personaje p1 = enf.getPersonaje1();
        Personaje p2 = enf.getPersonaje2();
        // Counts post-voto. Para el ganador es el total real; para el
        // perdedor es el mismo que pre-voto. Los reutilizamos para el push
        // WS para no hacer dos rondas a la BBDD.
        double votosP1 = votoRepository.scoreByEnfrentamientoAndPersonaje(enf, p1);
        double votosP2 = votoRepository.scoreByEnfrentamientoAndPersonaje(enf, p2);
        // además del conteo físico
        // publicamos la suma ponderada (peso 0.3 anónimo / 1.0 registrado)
        // para que el frontend reordene la caché live por la misma métrica
        // que el ORDER BY del ranking REST.
        Double pesoTotalesGanador = empate ? null : votoRepository.sumaPesoByPersonajeId(ganador.getId());
        double votosTotalesGanador = empate ? 0.0 : votoRepository.countByPersonajeId(ganador.getId());
        Personaje perdedor = empate ? null : (ganador.getId().equals(p1.getId()) ? p2 : p1);
        double votosGanador = empate ? votosP1 : (ganador.getId().equals(p1.getId()) ? votosP1 : votosP2);
        double votosPerdedor = empate ? votosP2 : (perdedor.getId().equals(p1.getId()) ? votosP1 : votosP2);

        // Push del estado actualizado del match al topic del
        // torneo. Los clientes viendo /torneos/{slug} actualizan el bracket
        // sin esperar al polling. Best-effort: si falla no afecta al voto.
        publicarBracketUpdate(enf, p1, votosP1, p2, votosP2);
        // además del total ponderado pasamos
        // el peso del voto RECIÉN registrado (0.30 anónimo / 1.00 registrado).
        // El frontend lo SUMA al pesoVotos de las cachés temporales (mes,
        // trimestre, año). Sin esto, el hook restaba pesoVotos absoluto
        // contra el de la caché temporal y contaminaba la ventana con el
        // histórico — un personaje con 150 pesoVotos all-time y 2 mensuales
        // saltaba a 151 en la caché mensual hasta el siguiente refetch.
        double pesoVotoRegistrado = guardado.getPeso() == null
                ? 1.0
                : guardado.getPeso().doubleValue();
        if (!empate) {
            publicarRankingDelta(ganador, votosTotalesGanador, pesoTotalesGanador,
                    pesoVotoRegistrado);
        }

        // Evento de dominio. BadgeEventListener escucha tras
        // commit y desbloquea badges de umbral (primer_voto/cien/mil).
        // Diseño extensible — futuros listeners podrán reaccionar también.
        if (usuario != null) {
            eventPublisher.publishEvent(new VotoRegistradoEvent(usuario, enf, ganador));
        }

        Integer votosAnonimosRestantes = null;
        if (usuario == null) {
            votosAnonimosRestantes = Math.max(0,
                    ANON_VOTE_LIMIT - (int) votoRepository.countByAnonSessionId(anon.sessionId()));
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
                empate);
        ResponseEntity.BodyBuilder ok = ResponseEntity.ok();
        if (usuario == null) {
            ok.header(HttpHeaders.SET_COOKIE, anonCookieFor(anon).toString());
        }
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

        CategoriaVoto categoria = CategoriaVoto.fromId(request == null ? null : request.getCategoria());
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

        Optional<Voto> votoOpt;
        if (usuario != null) {
            votoOpt = votoRepository.findByEnfrentamientoAndUsuario(enf, usuario);
        } else {
            AnonymousVoteContext anon = resolverAnonymousContext(httpRequest);
            votoOpt = votoRepository.findByEnfrentamientoAndAnonSessionId(enf, anon.sessionId());
        }
        if (votoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Voto voto = votoOpt.get();
        if (voto.getCategoria() != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("La intención de este voto ya estaba fijada");
        }
        voto.setCategoria(categoria.getId());
        votoRepository.save(voto);
        return ResponseEntity.noContent().build();
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

    private void publicarRankingDelta(Personaje ganador, double votosTotalesGanador,
            Double pesoTotalesGanador, double pesoVotoRegistrado) {
        if (messaging == null || ganador == null) return;
        try {
            // payload incluye:
            //   - pesoVotos: total ponderado all-time (para periodo='all').
            //   - deltaPeso: peso del voto recién emitido (0.3 / 1.0). El
            //     frontend lo suma a las cachés temporales, evitando
            //     contaminarlas con el total absoluto.
            var ev = new RankingDeltaEvent(PersonajeMiniDto.from(ganador),
                    votosTotalesGanador, 1, pesoTotalesGanador, pesoVotoRegistrado);
            messaging.convertAndSend("/topic/ranking-delta", ev);
        } catch (Exception e) {
            log.warn("Push WS ranking delta falló: personaje={} err={}",
                    ganador.getSlug(), e.getMessage());
        }
    }

    /**
     * cookie-first con fallback legacy.
     * Orden de resolución de la identidad anónima:
     *   1. Cookie firmada {@code as_anon} con HMAC verificable.
     *   2. Cookie legacy {@code as_anon_vote_id} (no firmada, mantenida 1
     *      release para no perder el cupo de votos invitados de usuarios
     *      ya activos).
     *   3. Header legacy {@code X-AS-Anonymous-Id}.
     *   4. Emitir nuevo token firmado y devolverlo en la respuesta.
     *
     * El campo {@code signedToken} del contexto, si no es null, manda al
     * controller a settear la cookie firmada en la respuesta (override del
     * legacy). Eso fuerza la migración progresiva sin invalidar sesiones.
     */
    private AnonymousVoteContext resolverAnonymousContext(HttpServletRequest request) {
        // Cookie firmada (nueva): identidad estable server-side.
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
                    // legacy y eventualmente emitimos una firma nueva.
                }
            }
        }
        // Cookie legacy (no firmada).
        String legacySessionId = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (ANON_COOKIE.equals(cookie.getName())) {
                    legacySessionId = normalizarAnonId(cookie.getValue());
                    break;
                }
            }
        }
        // Header legacy (último fallback aceptado).
        if (legacySessionId == null) {
            legacySessionId = normalizarAnonId(request.getHeader(ANON_ID_HEADER));
        }
        if (legacySessionId != null) {
            // Identidad legacy aceptada: preservamos el cupo histórico,
            // pero el throttle por IP+UA sigue aplicando. La cookie
            // firmada se emite cuando el cliente envíe su próximo voto
            // y haya perdido la legacy, o nunca si mantiene la legacy.
            return new AnonymousVoteContext(legacySessionId, hashAnonimo(request), null);
        }
        // Sin identidad reconocible: emitimos token firmado nuevo.
        String token = anonymousIdentityService.emit();
        var verified = anonymousIdentityService.verify(token);
        String sid = verified.orElseGet(() -> UUID.randomUUID().toString());
        return new AnonymousVoteContext(sid, hashAnonimo(request), token);
    }

    private String normalizarAnonId(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return ANON_ID_PATTERN.matcher(trimmed).matches() ? trimmed : null;
    }

    /**
     * Cookie de respuesta para la identidad anónima. Si el contexto trae
     * {@code signedToken} (identidad recién emitida), devolvemos la cookie
     * firmada httpOnly + Secure + SameSite=Lax con TTL 30d via
     * {@link AnonymousIdentityService#buildCookie(String)}. Si no, fallback
     * a la cookie legacy no firmada para mantener compatibilidad con
     * usuarios cuya identidad sigue llegando via header o cookie vieja.
     */
    private ResponseCookie anonCookieFor(AnonymousVoteContext context) {
        if (context.signedToken() != null) {
            return anonymousIdentityService.buildCookie(context.signedToken());
        }
        return anonCookieLegacy(context.sessionId());
    }

    private ResponseCookie anonCookie(String sessionId) {
        // Wrapper retro-compat con call sites que sólo pasan sessionId.
        // Para identidades firmadas, usar anonCookieFor(context) directamente.
        return anonCookieLegacy(sessionId);
    }

    private ResponseCookie anonCookieLegacy(String sessionId) {
        return ResponseCookie.from(ANON_COOKIE, sessionId)
                .path("/")
                .maxAge(Duration.ofDays(180))
                .sameSite("Lax")
                .secure(cookieSecure)
                .httpOnly(false)
                .build();
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
