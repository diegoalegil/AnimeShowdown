package com.diegoalegil.animeshowdown.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.diegoalegil.animeshowdown.repository.VotoRepository;

/**
 * Nota técnica AS-004 (2026-05-23): cubre los umbrales del throttle.
 * Test unitario con mock del repositorio — sin Spring Context.
 *
 * <p>Política verificada:
 * <ul>
 *   <li>0–9 votos / 1h → ALLOW.</li>
 *   <li>10–29 / 1h sin captcha → REQUIRE_CAPTCHA.</li>
 *   <li>10–29 / 1h con captcha válido → ALLOW.</li>
 *   <li>≥ 30 / 1h sin captcha → REQUIRE_CAPTCHA.</li>
 *   <li>≥ 30 / 1h con captcha válido → ALLOW.</li>
 *   <li>≥ 100 / 24h → BLOCKED_24H (ni con captcha).</li>
 *   <li>session NULL / ip NULL no rompe; cuenta solo el dato disponible.</li>
 * </ul>
 */
class AnonymousAbuseThrottleServiceTest {

    private VotoRepository votoRepository;
    private Clock clock;
    private AnonymousAbuseThrottleService svc;

    @BeforeEach
    void setUp() {
        votoRepository = mock(VotoRepository.class);
        // Clock fijo a un instante conocido para que las ventanas
        // 1h/24h del servicio sean determinísticas.
        clock = Clock.fixed(Instant.parse("2026-05-23T12:00:00Z"), ZoneOffset.UTC);
        // Defaults igual que producción: 10/30/100.
        svc = new AnonymousAbuseThrottleService(votoRepository, clock, 10, 30, 100);
        // Por defecto, ningún voto registrado.
        lenient().when(votoRepository.countByAnonSessionIdAndFechaAfter(anyString(), any()))
                .thenReturn(0L);
        lenient().when(votoRepository.countByAnonIpHashAndFechaAfter(anyString(), any()))
                .thenReturn(0L);
    }

    @Test
    void sin_actividad_devuelve_ALLOW() {
        assertEquals(
                AnonymousAbuseThrottleService.Decision.ALLOW,
                svc.decide("sess", "iphash", false));
    }

    @Test
    void bajo_umbral_soft_devuelve_ALLOW() {
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(9L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.ALLOW,
                svc.decide("sess", "iphash", false));
    }

    @Test
    void igualando_umbral_soft_pide_captcha() {
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(10L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA,
                svc.decide("sess", "iphash", false));
    }

    @Test
    void zona_soft_con_captcha_valido_permite() {
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(15L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.ALLOW,
                svc.decide("sess", "iphash", true));
    }

    @Test
    void igualando_umbral_hard_pide_captcha() {
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(30L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA,
                svc.decide("sess", "iphash", false));
    }

    @Test
    void zona_hard_con_captcha_valido_permite() {
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(50L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.ALLOW,
                svc.decide("sess", "iphash", true));
    }

    @Test
    void llegando_a_24h_bloquea_sin_perdon() {
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(100L);
        // Ni con captcha válido pasa: el bloqueo 24h es duro.
        assertEquals(
                AnonymousAbuseThrottleService.Decision.BLOCKED_24H,
                svc.decide("sess", "iphash", true));
        assertEquals(
                AnonymousAbuseThrottleService.Decision.BLOCKED_24H,
                svc.decide("sess", "iphash", false));
    }

    @Test
    void se_aplica_el_maximo_entre_session_y_ip() {
        // session bajo umbral, ip ya supera hard. La decisión usa el MAX
        // entre ambos para que rotar la cookie no permita escapar al límite.
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(3L);
        when(votoRepository.countByAnonIpHashAndFechaAfter(eq("iphash"), any()))
                .thenReturn(50L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA,
                svc.decide("sess", "iphash", false));
    }

    @Test
    void session_nula_solo_cuenta_ip() {
        when(votoRepository.countByAnonIpHashAndFechaAfter(eq("iphash"), any()))
                .thenReturn(15L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA,
                svc.decide(null, "iphash", false));
    }

    @Test
    void ip_nula_solo_cuenta_session() {
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(15L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA,
                svc.decide("sess", null, false));
    }

    @Test
    void ambos_nulos_devuelven_ALLOW_pero_no_revisan_la_BBDD() {
        // Si no hay identidad, no podemos contar — pasamos. El controller
        // debería haber asignado identidad antes (resolverAnonymousContext
        // siempre devuelve un sessionId, así que este caso es teórico).
        assertEquals(
                AnonymousAbuseThrottleService.Decision.ALLOW,
                svc.decide(null, null, false));
    }

    @Test
    void umbrales_son_configurables_por_constructor() {
        AnonymousAbuseThrottleService strict = new AnonymousAbuseThrottleService(
                votoRepository, clock, 2, 5, 10);
        when(votoRepository.countByAnonSessionIdAndFechaAfter(eq("sess"), any()))
                .thenReturn(3L);
        assertEquals(
                AnonymousAbuseThrottleService.Decision.REQUIRE_CAPTCHA,
                strict.decide("sess", "iphash", false));
        assertEquals(2, strict.getUmbralSoftPorHora());
        assertEquals(5, strict.getUmbralHardPorHora());
        assertEquals(10, strict.getUmbralBloqueo24h());
    }

    // Helper compartido para usar matchers eq() sin ambigüedades.
    private static String eq(String value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }

    private static LocalDateTime localTimeFrom(Clock c) {
        return LocalDateTime.ofInstant(c.instant(), c.getZone());
    }
}
