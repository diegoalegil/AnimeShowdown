package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.CartaTradeCreateRequest;
import com.diegoalegil.animeshowdown.model.CartaTradeEstado;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.CartaTradeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

class CartaTradingServiceTest {

    private CartaTradeRepository tradeRepository;
    private UsuarioRepository usuarioRepository;
    private CartaTradingService sut;

    @BeforeEach
    void setUp() {
        tradeRepository = mock(CartaTradeRepository.class);
        CartaRepository cartaRepository = mock(CartaRepository.class);
        UsuarioCartaRepository usuarioCartaRepository = mock(UsuarioCartaRepository.class);
        usuarioRepository = mock(UsuarioRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        sut = new CartaTradingService(
                tradeRepository, cartaRepository, usuarioCartaRepository, usuarioRepository, auditLogService);
    }

    @Test
    void crear_bloqueaLaFilaDelDestinatarioAntesDeContarElTope() {
        // El check-then-act del tope de ofertas pendientes debe estar protegido
        // por un lock pesimista sobre la fila del destinatario, adquirido ANTES
        // de contar. Si no, dos solicitantes concurrentes leerían count<tope a la
        // vez y ambos insertarían, superando el límite.
        Usuario solicitante = mock(Usuario.class);
        when(solicitante.getId()).thenReturn(1L);
        Usuario destinatario = mock(Usuario.class);
        when(destinatario.getId()).thenReturn(2L);

        var request = new CartaTradeCreateRequest("bob", 10L, 20L, "idem-1");

        when(tradeRepository.findBySolicitanteAndIdempotencyKey(eq(solicitante), any()))
                .thenReturn(Optional.empty());
        when(usuarioRepository.findByUsername("bob")).thenReturn(Optional.of(destinatario));
        when(usuarioRepository.findForUpdateById(2L)).thenReturn(Optional.of(destinatario));
        // Tope ya alcanzado → crear corta con 429 justo tras contar (sin tocar el
        // resto del flujo de cartas/save), lo que basta para fijar el orden.
        when(tradeRepository.countByEstadoAndDestinatario(CartaTradeEstado.PENDING, destinatario))
                .thenReturn(50L);

        assertThatThrownBy(() -> sut.crear(solicitante, request))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));

        InOrder orden = inOrder(usuarioRepository, tradeRepository);
        orden.verify(usuarioRepository).findForUpdateById(2L);
        orden.verify(tradeRepository).countByEstadoAndDestinatario(CartaTradeEstado.PENDING, destinatario);
    }
}
