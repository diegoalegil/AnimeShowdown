package com.diegoalegil.animeshowdown.dto;

/**
 * Respuesta de {@code POST /api/enfrentamientos/{id}/votar} (x —
 * propuesta de feedback inmediato tras votar).
 *
 * <p>Antes el endpoint devolvía la entidad Voto cruda. Ahora devolvemos un
 * DTO con los counts post-voto de ambos personajes en el enfrentamiento
 * para que el frontend pueda animar "+1" al ganador sin necesidad de
 * pedirlos en otra request.
 *
 * <p>Nuestro sistema de "ELO" es un proxy directo del conteo de votos
 * (no es un ELO matemático con K-factor). El delta es siempre +1 para el
 * ganador y 0 para el perdedor; lo dejamos explícito en el payload para
 * que el cliente no asuma el valor.
 *
 * <p>{@code monedasGanadas}: monedas que el voto va a acreditar (misión diaria
 * + hito), calculadas server-side para el toast "+N monedas". 0 para invitados
 * y cuando el voto no genera drop. La acreditación real la hace el listener
 * async idempotente; este número es la previsualización exacta de ese drop.
 */
public record VotoRegistradoDto(
        Long votoId,
        Long personajeGanadorId,
        double votosGanador,
        Long personajePerdedorId,
        double votosPerdedor,
        double delta,
        boolean anonimo,
        Integer votosAnonimosRestantes,
        boolean empate,
        long monedasGanadas) {

    public VotoRegistradoDto(
            Long votoId,
            Long personajeGanadorId,
            double votosGanador,
            Long personajePerdedorId,
            double votosPerdedor,
            double delta) {
        this(votoId, personajeGanadorId, votosGanador, personajePerdedorId, votosPerdedor,
                delta, false, null, false, 0L);
    }

    public VotoRegistradoDto(
            Long votoId,
            Long personajeGanadorId,
            double votosGanador,
            Long personajePerdedorId,
            double votosPerdedor,
            double delta,
            boolean anonimo,
            Integer votosAnonimosRestantes) {
        this(votoId, personajeGanadorId, votosGanador, personajePerdedorId, votosPerdedor,
                delta, anonimo, votosAnonimosRestantes, false, 0L);
    }
}
