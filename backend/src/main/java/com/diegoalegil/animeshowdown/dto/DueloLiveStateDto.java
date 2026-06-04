package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveEstado;

public record DueloLiveStateDto(
        Long id,
        DueloLiveEstado estado,
        String event,
        LocalDateTime serverNow,
        LocalDateTime creadoEn,
        LocalDateTime matchedEn,
        LocalDateTime startedEn,
        LocalDateTime finishedEn,
        int queuePosition,
        int fallbackAfterSeconds,
        int rondaActual,
        int rondasValidas,
        int miScore,
        int rivalScore,
        int miEloBefore,
        int rivalEloBefore,
        Integer miEloAfter,
        Integer rivalEloAfter,
        Integer miEloDelta,
        Integer rivalEloDelta,
        boolean soyJugador1,
        boolean botMatch,
        DueloLivePlayerDto yo,
        DueloLivePlayerDto rival,
        DueloLivePlayerDto ganador,
        DueloLiveRoundDto ronda,
        String message) {

    public static DueloLiveStateDto from(DueloLive duelo, DueloLiveRoundDto ronda,
            LocalDateTime now, boolean soyJugador1, int queuePosition, int fallbackAfterSeconds, String event, String message) {
        int miScore = soyJugador1 ? duelo.getScoreJugador1() : duelo.getScoreJugador2();
        int rivalScore = soyJugador1 ? duelo.getScoreJugador2() : duelo.getScoreJugador1();
        int miBefore = soyJugador1 ? duelo.getJugador1EloBefore() : duelo.getJugador2EloBefore();
        int rivalBefore = soyJugador1 ? duelo.getJugador2EloBefore() : duelo.getJugador1EloBefore();
        Integer miAfter = soyJugador1 ? duelo.getJugador1EloAfter() : duelo.getJugador2EloAfter();
        Integer rivalAfter = soyJugador1 ? duelo.getJugador2EloAfter() : duelo.getJugador1EloAfter();
        DueloLivePlayerDto yo = soyJugador1
                ? DueloLivePlayerDto.from(duelo.getJugador1())
                : DueloLivePlayerDto.from(duelo.getJugador2());
        DueloLivePlayerDto rival = soyJugador1
                ? (duelo.isJugador2Bot() ? DueloLivePlayerDto.botPlayer(duelo.getId()) : DueloLivePlayerDto.from(duelo.getJugador2()))
                : DueloLivePlayerDto.from(duelo.getJugador1());
        return new DueloLiveStateDto(
                duelo.getId(),
                duelo.getEstado(),
                event,
                now,
                duelo.getCreadoEn(),
                duelo.getMatchedEn(),
                duelo.getStartedEn(),
                duelo.getFinishedEn(),
                queuePosition,
                fallbackAfterSeconds,
                duelo.getRondaActual(),
                duelo.getRondasValidas(),
                miScore,
                rivalScore,
                miBefore,
                rivalBefore,
                miAfter,
                rivalAfter,
                miAfter == null ? null : miAfter - miBefore,
                rivalAfter == null ? null : rivalAfter - rivalBefore,
                soyJugador1,
                duelo.isJugador2Bot(),
                yo,
                rival,
                DueloLivePlayerDto.from(duelo.getGanador()),
                ronda,
                message);
    }
}
