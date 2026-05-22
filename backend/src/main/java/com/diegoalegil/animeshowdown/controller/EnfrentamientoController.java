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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.BracketUpdateEvent;
import com.diegoalegil.animeshowdown.dto.EnfrentamientoDto;
import com.diegoalegil.animeshowdown.dto.PersonajeMiniDto;
import com.diegoalegil.animeshowdown.dto.RankingDeltaEvent;
import com.diegoalegil.animeshowdown.dto.VotoEnfrentamientoRequest;
import com.diegoalegil.animeshowdown.dto.VotoRegistradoDto;
import com.diegoalegil.animeshowdown.event.VotoRegistradoEvent;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
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
    private static final String ANON_FINGERPRINT_HEADER = "X-AS-Anonymous-Fingerprint";
    private static final Pattern ANON_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{12,64}$");
    private static final int ANON_VOTE_LIMIT = 5;
    private static final BigDecimal ANON_VOTE_WEIGHT = new BigDecimal("0.30");

    private final EnfrentamientoRepository enfrentamientoRepository;
    private final VotoRepository votoRepository;
    private final SimpMessagingTemplate messaging;
    private final ApplicationEventPublisher eventPublisher;
    private final AnimeShowdownMetrics metrics;
    private final boolean requiereEmailVerificado;
    private final boolean cookieSecure;

    public EnfrentamientoController(EnfrentamientoRepository enfrentamientoRepository,
            VotoRepository votoRepository,
            @Autowired(required = false) SimpMessagingTemplate messaging,
            ApplicationEventPublisher eventPublisher,
            AnimeShowdownMetrics metrics,
            @Value("${app.email-verification.required-to-vote:true}") boolean requiereEmailVerificado,
            @Value("${app.refresh-token.cookie-secure:true}") boolean cookieSecure) {
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.votoRepository = votoRepository;
        this.messaging = messaging;
        this.eventPublisher = eventPublisher;
        this.metrics = metrics;
        this.requiereEmailVerificado = requiereEmailVerificado;
        this.cookieSecure = cookieSecure;
    }

    /**
     * Devuelve un enfrentamiento "abierto" aleatorio (de un torneo
     * IN_PROGRESS, con ambos personajes y sin ganador) para que VotarPage
     * pueda mostrarlo en modo backend. 404 si ahora mismo no hay matches
     * abiertos — el frontend hace fallback a modo casual con pares random
     * locales (Plan v2 §1.1).
     */
    @GetMapping("/aleatorio")
    public ResponseEntity<EnfrentamientoDto> aleatorio() {
        return enfrentamientoRepository.findEnfrentamientoAbiertoAleatorio()
                .map(e -> ResponseEntity.ok(EnfrentamientoDto.from(e, null)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Audit P2 (2026-05-17): @Transactional es OBLIGATORIO aquí, no estético.
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

        // Audit P1 (2026-05-17): antes solo se validaba el estado del torneo.
        // Por id directo el cliente podía votar:
        //  - Matches ya resueltos (ganador != null): votos inflados sobre un
        //    resultado cerrado, afectando counts post-bracket y stats.
        //  - Matches de R2+ todavía sin participantes propagados (personaje1
        //    o 2 null): NullPointerException al hacer .getId() abajo → 500.
        // Ambos rechazados explícitamente con 409 + mensaje claro.
        if (enf.getGanador() != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Este enfrentamiento ya está cerrado");
        }
        if (enf.getPersonaje1() == null || enf.getPersonaje2() == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Este enfrentamiento aún no tiene participantes asignados (ronda futura del bracket)");
        }

        // Plan v2 §2.4: usuarios PENDIENTE de verificación de email no
        // pueden votar. Toggle vía app.email-verification.required-to-vote
        // (true en prod, false en tests para no obligar al fixture a
        // simular el flujo completo de email). 403 con mensaje claro.
        AnonymousVoteContext anon = usuario == null ? resolverAnonymousContext(httpRequest) : null;

        if (usuario != null && requiereEmailVerificado && !usuario.estaVerificado()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Necesitas verificar tu email antes de votar. Revisa tu bandeja de entrada.");
        }

        Long ganadorId = request.getPersonajeGanadorId();
        Personaje ganador;
        if (enf.getPersonaje1().getId().equals(ganadorId)) {
            ganador = enf.getPersonaje1();
        } else if (enf.getPersonaje2().getId().equals(ganadorId)) {
            ganador = enf.getPersonaje2();
        } else {
            return ResponseEntity.badRequest()
                    .body("El personaje no pertenece a este enfrentamiento");
        }

        if (usuario != null) {
            if (votoRepository.existsByEnfrentamientoAndUsuario(enf, usuario)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body("Ya has votado este enfrentamiento");
            }
        } else {
            long votosAnonimosUsados = votoRepository.countByAnonSessionId(anon.sessionId());
            if (votosAnonimosUsados >= ANON_VOTE_LIMIT) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header(HttpHeaders.SET_COOKIE, anonCookie(anon.sessionId()).toString())
                        .body(java.util.Map.of(
                                "message", "Has agotado tus 5 votos invitados. Crea cuenta gratis para seguir votando.",
                                "limite", ANON_VOTE_LIMIT,
                                "votosAnonimosRestantes", 0));
            }
            if (votoRepository.existsByEnfrentamientoAndAnonSessionId(enf, anon.sessionId())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .header(HttpHeaders.SET_COOKIE, anonCookie(anon.sessionId()).toString())
                        .body("Ya has votado este enfrentamiento como invitado");
            }
        }

        Voto voto = new Voto(ganador, usuario, enf);
        if (usuario == null) {
            voto.setPeso(ANON_VOTE_WEIGHT);
            voto.setAnonSessionId(anon.sessionId());
            voto.setAnonIpHash(anon.ipHash());
        }
        Voto guardado = votoRepository.save(voto);
        metrics.votoRegistrado();

        Personaje p1 = enf.getPersonaje1();
        Personaje p2 = enf.getPersonaje2();
        // Counts post-voto. Para el ganador es el total real; para el
        // perdedor es el mismo que pre-voto. Los reutilizamos para el push
        // WS para no hacer dos rondas a la BBDD.
        long votosP1 = votoRepository.countByEnfrentamientoAndPersonaje(enf, p1);
        long votosP2 = votoRepository.countByEnfrentamientoAndPersonaje(enf, p2);
        long votosTotalesGanador = votoRepository.countByPersonajeId(ganador.getId());
        // Audit externo B2.1a (2026-05-22): además del conteo físico
        // publicamos la suma ponderada (peso 0.3 anónimo / 1.0 registrado)
        // para que el frontend reordene la caché live por la misma métrica
        // que el ORDER BY del ranking REST.
        Double pesoTotalesGanador = votoRepository.sumaPesoByPersonajeId(ganador.getId());
        Personaje perdedor = ganador.getId().equals(p1.getId()) ? p2 : p1;
        long votosGanador = ganador.getId().equals(p1.getId()) ? votosP1 : votosP2;
        long votosPerdedor = perdedor.getId().equals(p1.getId()) ? votosP1 : votosP2;

        // Plan v2 §2.13: push del estado actualizado del match al topic del
        // torneo. Los clientes viendo /torneos/{slug} actualizan el bracket
        // sin esperar al polling. Best-effort: si falla no afecta al voto.
        publicarBracketUpdate(enf, p1, votosP1, p2, votosP2);
        // Audit externo B2.2 (2026-05-23): además del total ponderado pasamos
        // el peso del voto RECIÉN registrado (0.30 anónimo / 1.00 registrado).
        // El frontend lo SUMA al pesoVotos de las cachés temporales (mes,
        // trimestre, año). Sin esto, el hook restaba pesoVotos absoluto
        // contra el de la caché temporal y contaminaba la ventana con el
        // histórico — un personaje con 150 pesoVotos all-time y 2 mensuales
        // saltaba a 151 en la caché mensual hasta el siguiente refetch.
        double pesoVotoRegistrado = guardado.getPeso() == null
                ? 1.0
                : guardado.getPeso().doubleValue();
        publicarRankingDelta(ganador, votosTotalesGanador, pesoTotalesGanador,
                pesoVotoRegistrado);

        // Plan v2 §4.2: evento de dominio. BadgeEventListener escucha tras
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
                ganador.getId(),
                votosGanador,
                perdedor.getId(),
                votosPerdedor,
                usuario == null ? ANON_VOTE_WEIGHT.doubleValue() : 1.0,
                usuario == null,
                votosAnonimosRestantes);
        ResponseEntity.BodyBuilder ok = ResponseEntity.ok();
        if (usuario == null) {
            ok.header(HttpHeaders.SET_COOKIE, anonCookie(anon.sessionId()).toString());
        }
        return ok.body(dto);
    }

    /**
     * Publica un {@link BracketUpdateEvent} al topic público del torneo
     * con los counts ya calculados por el caller (evitamos doble round-trip).
     */
    private void publicarBracketUpdate(Enfrentamiento enf,
            Personaje p1, long v1, Personaje p2, long v2) {
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

    private void publicarRankingDelta(Personaje ganador, long votosTotalesGanador,
            Double pesoTotalesGanador, double pesoVotoRegistrado) {
        if (messaging == null || ganador == null) return;
        try {
            // Audit externo B2.1a + B2.2 (2026-05-22/23): payload incluye:
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

    private AnonymousVoteContext resolverAnonymousContext(HttpServletRequest request) {
        String sessionId = normalizarAnonId(request.getHeader(ANON_ID_HEADER));
        if (sessionId == null && request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (ANON_COOKIE.equals(cookie.getName())) {
                    sessionId = normalizarAnonId(cookie.getValue());
                    break;
                }
            }
        }
        if (sessionId == null) {
            sessionId = UUID.randomUUID().toString();
        }
        return new AnonymousVoteContext(sessionId, hashAnonimo(request, sessionId));
    }

    private String normalizarAnonId(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return ANON_ID_PATTERN.matcher(trimmed).matches() ? trimmed : null;
    }

    private ResponseCookie anonCookie(String sessionId) {
        return ResponseCookie.from(ANON_COOKIE, sessionId)
                .path("/")
                .maxAge(Duration.ofDays(180))
                .sameSite("Lax")
                .secure(cookieSecure)
                .httpOnly(false)
                .build();
    }

    private String hashAnonimo(HttpServletRequest request, String sessionId) {
        String ip = primerIp(request.getHeader("X-Forwarded-For"));
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        String fingerprint = Optional.ofNullable(request.getHeader(ANON_FINGERPRINT_HEADER)).orElse("");
        String ua = Optional.ofNullable(request.getHeader("User-Agent")).orElse("");
        String raw = ip + "|" + ua + "|" + fingerprint + "|" + sessionId;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(raw.hashCode());
        }
    }

    private String primerIp(String forwardedFor) {
        if (forwardedFor == null || forwardedFor.isBlank()) return null;
        int comma = forwardedFor.indexOf(',');
        return comma >= 0 ? forwardedFor.substring(0, comma).trim() : forwardedFor.trim();
    }

    private record AnonymousVoteContext(String sessionId, String ipHash) {}
}
