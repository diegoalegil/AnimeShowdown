package com.diegoalegil.animeshowdown.dto;

/**
 * Resumen de referrals del usuario actual.
 *
 * <p>{@code codigo} es el código único compartible, p.ej. {@code A7K2X9PD}.
 * {@code invitadosVerificados} es el count actual de referidos con email
 * verificado. {@code umbralReclutador} es el target para desbloquear el
 * badge (constante {@link com.diegoalegil.animeshowdown.service.ReferralService#UMBRAL_RECLUTADOR}).
 * {@code reclutadorDesbloqueado} es true si ya superó el umbral.
 */
public record ReferralStatsDto(
        String codigo,
        long invitadosVerificados,
        int umbralReclutador,
        boolean reclutadorDesbloqueado) {
}
