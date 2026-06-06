package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.MarcoDto;
import com.diegoalegil.animeshowdown.dto.MarcosResponse;
import com.diegoalegil.animeshowdown.model.AuditEvento;
import com.diegoalegil.animeshowdown.model.MotivoMovimiento;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioMarco;
import com.diegoalegil.animeshowdown.repository.UsuarioMarcoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

class MarcoServiceTest {

    private final UsuarioMarcoRepository usuarioMarcoRepo = mock(UsuarioMarcoRepository.class);
    private final UsuarioRepository usuarioRepo = mock(UsuarioRepository.class);
    private final MonederoService monederoService = mock(MonederoService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final MarcoService service =
            new MarcoService(usuarioMarcoRepo, usuarioRepo, monederoService, auditLogService);

    private final Usuario usuario = usuario();

    private static Usuario usuario() {
        Usuario u = new Usuario("marquito", "{noop}secreta123", "marquito@example.com");
        u.setId(7L);
        return u;
    }

    private MarcoDto marco(MarcosResponse r, String id) {
        return r.marcos().stream().filter(m -> m.id().equals(id)).findFirst().orElseThrow();
    }

    // ---- comprar -----------------------------------------------------------

    @Test
    void comprarMarcoDesconocidoLanza404YNoDebita() {
        assertThatThrownBy(() -> service.comprar(usuario, "no-existe", null))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        verify(monederoService, never()).debitar(any(), any(), any(), anyLong());
        verify(usuarioMarcoRepo, never()).saveAndFlush(any());
    }

    @Test
    void comprarMarcoYaPoseidoLanza409YNoDebita() {
        when(usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(7L, "oro")).thenReturn(true);

        assertThatThrownBy(() -> service.comprar(usuario, "oro", null))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        verify(usuarioMarcoRepo, never()).saveAndFlush(any());
        verify(monederoService, never()).debitar(any(), any(), any(), anyLong());
    }

    @Test
    void comprarOkInsertaPosesionYDebitaElPrecioExacto() {
        when(usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(7L, "oro")).thenReturn(false);
        when(monederoService.debitar(usuario, MotivoMovimiento.COMPRA_MARCO, "marco:oro", 600L))
                .thenReturn(900L);
        when(usuarioMarcoRepo.findByUsuarioId(7L))
                .thenReturn(List.of(new UsuarioMarco(usuario, "oro")));
        when(usuarioRepo.findById(7L)).thenReturn(Optional.of(usuario));
        when(monederoService.saldoDe(usuario)).thenReturn(900L);

        MarcosResponse r = service.comprar(usuario, "oro", null);

        // El INSERT de posesión ocurre ANTES del débito (atomicidad anti-doble-cobro).
        var orden = org.mockito.Mockito.inOrder(usuarioMarcoRepo, monederoService);
        orden.verify(usuarioMarcoRepo).saveAndFlush(any(UsuarioMarco.class));
        orden.verify(monederoService).debitar(usuario, MotivoMovimiento.COMPRA_MARCO, "marco:oro", 600L);

        assertThat(r.saldo()).isEqualTo(900L);
        assertThat(marco(r, "oro").poseido()).isTrue();
        assertThat(marco(r, "plata").poseido()).isFalse();

        // Transparencia: el gasto queda también en el audit log con el saldo final.
        verify(auditLogService).registrar(eq(AuditEvento.MARCO_COMPRADO), eq(usuario), any(), any());
    }

    @Test
    void comprarConSaldoInsuficientePropagaElConflictDelMonedero() {
        when(usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(7L, "prismatico")).thenReturn(false);
        when(monederoService.debitar(eq(usuario), eq(MotivoMovimiento.COMPRA_MARCO),
                eq("marco:prismatico"), eq(3000L)))
                .thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Saldo insuficiente"));

        assertThatThrownBy(() -> service.comprar(usuario, "prismatico", null))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        // Se intentó insertar y debitar; el rollback de la tx (gestionado por el
        // contenedor) deshace el INSERT al propagarse la excepción.
        verify(usuarioMarcoRepo).saveAndFlush(any(UsuarioMarco.class));
        verify(monederoService).debitar(usuario, MotivoMovimiento.COMPRA_MARCO, "marco:prismatico", 3000L);
        // El débito falló: no debe quedar un audit de compra "fantasma".
        verify(auditLogService, never()).registrar(any(), any(), any(), any());
    }

    @Test
    void comprarConCarreraUniqueLanza409YNoDebita() {
        when(usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(7L, "oro")).thenReturn(false);
        when(usuarioMarcoRepo.saveAndFlush(any(UsuarioMarco.class)))
                .thenThrow(new DataIntegrityViolationException("uk_usuario_marco_unico"));

        assertThatThrownBy(() -> service.comprar(usuario, "oro", null))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        verify(monederoService, never()).debitar(any(), any(), any(), anyLong());
        verify(auditLogService, never()).registrar(any(), any(), any(), any());
    }

    // ---- equipar -----------------------------------------------------------

    @Test
    void equiparMarcoPoseidoLoActiva() {
        when(usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(7L, "oro")).thenReturn(true);
        when(usuarioRepo.findById(7L)).thenReturn(Optional.of(usuario));

        MarcosResponse r = service.equipar(usuario, "oro");

        assertThat(usuario.getMarcoAvatar()).isEqualTo("oro");
        assertThat(r.equipado()).isEqualTo("oro");
        verify(usuarioRepo).save(usuario);
    }

    @Test
    void equiparMarcoNoPoseidoLanza409YNoGuarda() {
        when(usuarioMarcoRepo.existsByUsuarioIdAndMarcoId(7L, "oro")).thenReturn(false);

        assertThatThrownBy(() -> service.equipar(usuario, "oro"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        verify(usuarioRepo, never()).save(any());
    }

    @Test
    void equiparMarcoInexistenteLanza404() {
        assertThatThrownBy(() -> service.equipar(usuario, "no-existe"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        verify(usuarioRepo, never()).save(any());
    }

    @Test
    void desequiparNullPonisMarcoANuloSinComprobarPosesion() {
        usuario.setMarcoAvatar("oro");
        when(usuarioRepo.findById(7L)).thenReturn(Optional.of(usuario));

        MarcosResponse r = service.equipar(usuario, "  ");

        assertThat(usuario.getMarcoAvatar()).isNull();
        assertThat(r.equipado()).isNull();
        verify(usuarioRepo).save(usuario);
        verify(usuarioMarcoRepo, never()).existsByUsuarioIdAndMarcoId(anyLong(), any());
    }
}
