package com.diegoalegil.animeshowdown.service;

import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.model.Usuario;

@Service
public class PvpEloService {

    private static final int FALLBACK_MATCH_MAX_DELTA = 4;

    public PvpEloResult aplicarResultado(Usuario jugador1, Usuario jugador2, double scoreJugador1, boolean walkover) {
        int elo1 = jugador1.getEloPvp();
        int elo2 = jugador2 == null ? 1000 : jugador2.getEloPvp();
        int k1 = kFactor(jugador1.getPvpPartidos());
        int k2 = jugador2 == null ? 16 : kFactor(jugador2.getPvpPartidos());

        double expected1 = expected(elo1, elo2);
        double expected2 = 1.0 - expected1;
        double scoreJugador2 = 1.0 - scoreJugador1;

        int delta1 = (int) Math.round(k1 * (scoreJugador1 - expected1));
        int delta2 = jugador2 == null ? 0 : (int) Math.round(k2 * (scoreJugador2 - expected2));
        if (jugador2 == null) {
            delta1 = Math.max(-FALLBACK_MATCH_MAX_DELTA, Math.min(FALLBACK_MATCH_MAX_DELTA, delta1));
        }

        if (walkover) {
            if (scoreJugador1 == 1.0) {
                delta2 = Math.min(delta2 * 2, -1);
            } else if (scoreJugador1 == 0.0) {
                delta1 = Math.min(delta1 * 2, -1);
            }
        }

        jugador1.setEloPvp(Math.max(100, elo1 + delta1));
        jugador1.setPvpPartidos(jugador1.getPvpPartidos() + 1);
        if (jugador2 != null) {
            jugador2.setEloPvp(Math.max(100, elo2 + delta2));
            jugador2.setPvpPartidos(jugador2.getPvpPartidos() + 1);
        }
        return new PvpEloResult(elo1, elo2, jugador1.getEloPvp(), jugador2 == null ? elo2 : jugador2.getEloPvp(),
                delta1, delta2);
    }

    private static int kFactor(int partidos) {
        return partidos < 30 ? 32 : 16;
    }

    private static double expected(int eloA, int eloB) {
        return 1.0 / (1.0 + Math.pow(10.0, (eloB - eloA) / 400.0));
    }

    public record PvpEloResult(
            int jugador1Before,
            int jugador2Before,
            int jugador1After,
            int jugador2After,
            int jugador1Delta,
            int jugador2Delta) {
    }
}
