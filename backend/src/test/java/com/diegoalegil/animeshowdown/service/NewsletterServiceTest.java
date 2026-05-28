package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.model.NewsletterSub;
import com.diegoalegil.animeshowdown.repository.NewsletterSubRepository;
import com.diegoalegil.animeshowdown.service.EmailService;

@ExtendWith(MockitoExtension.class)
class NewsletterServiceTest {

    @Mock private NewsletterSubRepository repo;
    @Mock private EmailService emailService;

    private NewsletterService sut;

    @BeforeEach
    void setUp() {
        sut = new NewsletterService(repo, emailService, "https://animeshowdown.dev");
    }

    // ── suscribir ──────────────────────────────────────────────────────────────

    @Test
    void suscribirNullLanzaExcepcion() {
        assertThatThrownBy(() -> sut.suscribir(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("email es obligatorio");
    }

    @Test
    void suscribirVacioLanzaExcepcion() {
        assertThatThrownBy(() -> sut.suscribir("   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("email inválido");
    }

    @Test
    void suscribirSinArrobaLanzaExcepcion() {
        assertThatThrownBy(() -> sut.suscribir("no-es-email"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("email inválido");
    }

    @Test
    void suscribirLongitudExcesivaLanzaExcepcion() {
        String longEmail = "a".repeat(250) + "@test.com"; // 255+ chars
        assertThatThrownBy(() -> sut.suscribir(longEmail))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("email demasiado largo");
    }

    @Test
    void suscribirNuevoEmailDevuelveCREADA() {
        when(repo.findByEmail("alice@test.com")).thenReturn(Optional.empty());
        when(repo.save(any(NewsletterSub.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = sut.suscribir("alice@test.com");

        assertThat(result).isEqualTo(NewsletterService.ResultadoSuscripcion.CREADA);
        verify(emailService).enviarConfirmacionNewsletter(anyString(), anyString());
    }

    @Test
    void suscribirYaConfirmadoDevuelveYA_CONFIRMADA() {
        NewsletterSub existente = new NewsletterSub("bob@test.com");
        existente.marcarConfirmado(); // confirms via marcarConfirmado()
        when(repo.findByEmail("bob@test.com")).thenReturn(Optional.of(existente));

        var result = sut.suscribir("BOB@test.com"); // case-insensitive

        assertThat(result).isEqualTo(NewsletterService.ResultadoSuscripcion.YA_CONFIRMADA);
        verify(repo, never()).save(any());
        verify(emailService, never()).enviarConfirmacionNewsletter(anyString(), anyString());
    }

    @Test
    void suscribirExistenteSinConfirmarDevuelveREENVIADA() {
        NewsletterSub existente = new NewsletterSub("carla@test.com");
        String oldToken = existente.getTokenConfirm();
        when(repo.findByEmail("carla@test.com")).thenReturn(Optional.of(existente));
        when(repo.save(any(NewsletterSub.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = sut.suscribir("carla@test.com");

        assertThat(result).isEqualTo(NewsletterService.ResultadoSuscripcion.REENVIADA);
        assertThat(existente.getTokenConfirm()).isNotEqualTo(oldToken);
        verify(emailService).enviarConfirmacionNewsletter(anyString(), anyString());
    }

    // ── confirmar ──────────────────────────────────────────────────────────────

    @Test
    void confirmarNullDevuelveFalse() {
        assertThat(sut.confirmar(null)).isFalse();
    }

    @Test
    void confirmarBlankDevuelveFalse() {
        assertThat(sut.confirmar("   ")).isFalse();
    }

    @Test
    void confirmarTokenInexistenteDevuelveFalse() {
        when(repo.findByTokenConfirm("unknown-token")).thenReturn(Optional.empty());

        assertThat(sut.confirmar("unknown-token")).isFalse();
    }

    @Test
    void confirmarTokenExpiradoDevuelveFalse() throws Exception {
        NewsletterSub sub = new NewsletterSub("dave@test.com");
        // Set confirmExpiraEn to the past via reflection (no public setter)
        Field field = NewsletterSub.class.getDeclaredField("confirmExpiraEn");
        field.setAccessible(true);
        field.set(sub, LocalDateTime.now().minusHours(1));
        when(repo.findByTokenConfirm(sub.getTokenConfirm())).thenReturn(Optional.of(sub));

        assertThat(sut.confirmar(sub.getTokenConfirm())).isFalse();
        assertThat(sub.isConfirmado()).isFalse();
    }

    @Test
    void confirmarTokenValidoMarcaConfirmado() {
        NewsletterSub sub = new NewsletterSub("eve@test.com");
        when(repo.findByTokenConfirm(sub.getTokenConfirm())).thenReturn(Optional.of(sub));
        when(repo.save(any(NewsletterSub.class))).thenAnswer(inv -> inv.getArgument(0));

        boolean result = sut.confirmar(sub.getTokenConfirm());

        assertThat(result).isTrue();
        assertThat(sub.isConfirmado()).isTrue();
        assertThat(sub.getConfirmExpiraEn()).isNull();
    }

    // ── unsubscribir ───────────────────────────────────────────────────────────

    @Test
    void unsubscribirNullDevuelveFalse() {
        assertThat(sut.unsubscribir(null)).isFalse();
    }

    @Test
    void unsubscribirBlankDevuelveFalse() {
        assertThat(sut.unsubscribir("  ")).isFalse();
    }

    @Test
    void unsubscribirTokenInexistenteDevuelveFalse() {
        when(repo.findByTokenUnsubscribe("unknown")).thenReturn(Optional.empty());

        assertThat(sut.unsubscribir("unknown")).isFalse();
        verify(repo, never()).delete(any());
    }

    @Test
    void unsubscribirTokenValidoBorraSub() {
        NewsletterSub sub = new NewsletterSub("frank@test.com");
        String token = sub.getTokenUnsubscribe();
        when(repo.findByTokenUnsubscribe(token)).thenReturn(Optional.of(sub));

        boolean result = sut.unsubscribir(token);

        assertThat(result).isTrue();
        verify(repo).delete(sub);
    }
}
