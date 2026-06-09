package com.diegoalegil.animeshowdown.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class FantasyShowdownWeeklyJob {

    private static final Logger log = LoggerFactory.getLogger(FantasyShowdownWeeklyJob.class);
    private static final Duration LOCK_TTL = Duration.ofDays(6);

    private final FantasyShowdownService fantasyShowdownService;
    private final JobLockService jobLock;
    private final Clock clock;

    public FantasyShowdownWeeklyJob(
            FantasyShowdownService fantasyShowdownService,
            JobLockService jobLock,
            Clock clock) {
        this.fantasyShowdownService = fantasyShowdownService;
        this.jobLock = jobLock;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.fantasy.weekly.cron:0 5 0 * * MON}", zone = "UTC")
    public void cerrarYBloquearSemana() {
        if (!jobLock.intentarAdquirir("fantasy_weekly", LOCK_TTL)) {
            return; // otra instancia ya cerro fantasy en este slot semanal
        }
        LocalDate hoy = LocalDate.now(clock);
        String semanaAnterior = FantasyShowdownService.semanaIso(hoy.minusWeeks(1));
        String semanaActual = FantasyShowdownService.semanaIso(hoy);
        try {
            int cerrados = fantasyShowdownService.cerrarSemana(semanaAnterior);
            int bloqueados = fantasyShowdownService.bloquearEquiposSemana(semanaActual);
            log.info("Fantasy weekly job: cerrados={} semanaAnterior={} bloqueados={} semanaActual={}",
                    cerrados, semanaAnterior, bloqueados, semanaActual);
        } catch (Exception e) {
            log.warn("Fantasy weekly job fallo: {}", e.getMessage());
        }
    }
}
