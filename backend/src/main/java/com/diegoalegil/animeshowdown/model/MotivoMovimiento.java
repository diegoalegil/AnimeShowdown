package com.diegoalegil.animeshowdown.model;

/**
 * Motivo de un movimiento de moneda en el {@code monedero_movimiento}.
 *
 * <p>Los {@code DROP_*} son ganancias (delta &gt; 0) que el SERVIDOR decide al
 * jugar; {@link #COMPRA_SOBRE} es el gasto (delta &lt; 0) al abrir un sobre.
 * La transparencia anti-casino se apoya en que cada motivo queda registrado
 * tanto en el ledger como en el audit log.
 */
public enum MotivoMovimiento {
    /** Drop por alcanzar un hito de votos (cada N votos). */
    DROP_VOTO,
    /** Drop por completar la misión diaria (primer voto del día UTC). */
    DROP_MISION_DIARIA,
    /** Drop por predecir/ganar un torneo (predicciones resueltas a favor). */
    DROP_TORNEO,
    /** Drop por ganar una partida de los daily games (duelo live PvP). */
    DROP_DUELO,
    /** Drop por acertar en un juego validado en servidor (ELO Duel). */
    DROP_JUEGO,
    /** Gasto al comprar/abrir un sobre. */
    COMPRA_SOBRE,
    /** Conversión de carta duplicada a moneda blanda. */
    DUPLICADO_CARTA,
    /** Cofre diario reclamado explícitamente por el usuario. */
    COFRE_DIARIO,
    /** Sobre de bienvenida gratuito para nuevos usuarios (especial garantizada). */
    SOBRE_BIENVENIDA,
    /** Moneda extra repartida al cerrar una copa de evento a quien predijo en ella. */
    RECOMPENSA_EVENTO,
    /** Gasto al comprar un marco de avatar (cosmético coin-sink). */
    COMPRA_MARCO
}
