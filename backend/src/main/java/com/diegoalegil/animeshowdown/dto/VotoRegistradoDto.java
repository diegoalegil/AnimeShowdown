package com.diegoalegil.animeshowdown.dto;

/**
 * Respuesta de {@code POST /api/enfrentamientos/{id}/votar} (Plan v2 §4.x —
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
 */
public record VotoRegistradoDto(
        Long votoId,
        Long personajeGanadorId,
        long votosGanador,
        Long personajePerdedorId,
        long votosPerdedor,
        double delta,
        boolean anonimo,
        Integer votosAnonimosRestantes) {

    public VotoRegistradoDto(
            Long votoId,
            Long personajeGanadorId,
            long votosGanador,
            Long personajePerdedorId,
            long votosPerdedor,
            double delta) {
        this(votoId, personajeGanadorId, votosGanador, personajePerdedorId, votosPerdedor,
                delta, false, null);
    }
}
