package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.CartaTrade;
import com.diegoalegil.animeshowdown.model.Usuario;

public record CartaTradeDto(
        Long id,
        String estado,
        String rol,
        String solicitanteUsername,
        String destinatarioUsername,
        CartaDto cartaOfrecida,
        CartaDto cartaSolicitada,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn,
        LocalDateTime respondidoEn) {

    public static CartaTradeDto from(CartaTrade trade, Usuario viewer) {
        String rol = viewer != null && trade.getDestinatario().getId().equals(viewer.getId())
                ? "DESTINATARIO"
                : "SOLICITANTE";
        return new CartaTradeDto(
                trade.getId(),
                trade.getEstado().name(),
                rol,
                trade.getSolicitante().getUsername(),
                trade.getDestinatario().getUsername(),
                CartaDto.from(trade.getCartaOfrecida(), null),
                CartaDto.from(trade.getCartaSolicitada(), null),
                trade.getCreadoEn(),
                trade.getActualizadoEn(),
                trade.getRespondidoEn());
    }
}
