package com.diegoalegil.animeshowdown.config;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;
import com.diegoalegil.animeshowdown.service.BracketService;
import com.diegoalegil.animeshowdown.service.ReferralService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;

/**
 * Seeder de personajes que sincroniza la BBDD con personajes-seed.json (que
 * genera scripts/sync-personajes.mjs desde frontend/img/). El seed es la
 * fuente de verdad.
 *
 * Tres operaciones idempotentes en cada arranque:
 *
 * 1. INSERT: slugs en seed que NO están en BBDD → se crean.
 * 2. UPDATE: slugs en ambos → se actualiza nombre/anime/descripcion/imagenUrl
 *    si difieren. Sin esto, cambios al seed (ej. mover imágenes a /img/Anime/)
 *    no se propagaban a la BBDD live.
 * 3. DELETE: slugs en BBDD que ya NO están en seed → se borran junto a sus
 *    votos y enfrentamientos asociados (en transacción).
 *
 * El borrado en cascada es agresivo pero coherente con la decisión de
 * usuario: "borra lo que ya no existe". Si un personaje desaparece del seed,
 * los datos derivados (votos del usuario sobre ese personaje, enfrentamientos
 * donde participaba) también desaparecen.
 *
 * Si algún paso falla (ej. JSON malformado, error de FK), se loguea pero la
 * app sigue arrancando — el catálogo simplemente quedará desactualizado hasta
 * el siguiente boot, no impide servir el resto del API.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String SEED_FILE = "personajes-seed.json";
    private static final String SEED_TORNEOS_FILE = "torneos-seed.json";

    private final PersonajeRepository personajeRepository;
    private final VotoRepository votoRepository;
    private final EnfrentamientoRepository enfrentamientoRepository;
    private final TorneoRepository torneoRepository;
    private final BracketService bracketService;
    private final ReferralService referralService;
    private final ObjectMapper objectMapper;

    // Self-injection vía proxy para que @Transactional aplique al llamar
    // self.sincronizar(). Sin esto, this.sincronizar() es una invocación
    // directa al método del bean concreto (no del proxy) y Spring no
    // intercepta — la "transacción" queda en auto-commit por entity y un
    // fallo a mitad del seed deja la BBDD a medias.
    @Autowired
    @Lazy
    private DataSeeder self;

    public DataSeeder(
            PersonajeRepository personajeRepository,
            VotoRepository votoRepository,
            EnfrentamientoRepository enfrentamientoRepository,
            TorneoRepository torneoRepository,
            BracketService bracketService,
            ReferralService referralService,
            ObjectMapper objectMapper) {
        this.personajeRepository = personajeRepository;
        this.votoRepository = votoRepository;
        this.enfrentamientoRepository = enfrentamientoRepository;
        this.torneoRepository = torneoRepository;
        this.bracketService = bracketService;
        this.referralService = referralService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) {
        log.info("DataSeeder iniciado: sincronizando con {} y {}", SEED_FILE, SEED_TORNEOS_FILE);

        // Pre-flight: leer y validar el seed antes de tocar BBDD. Si hay
        // slugs duplicados (regresión histórica del sync script que llegó a
        // generar 2815 entries para 700 personajes reales), abortamos el
        // arranque — preferible no arrancar a arrancar con catálogo corrupto.
        List<SeedPersonaje> entradas;
        try (InputStream is = new ClassPathResource(SEED_FILE).getInputStream()) {
            entradas = objectMapper.readValue(is, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException(
                    "DataSeeder no puede leer " + SEED_FILE + ": " + e.getMessage(), e);
        }
        validarSinDuplicados(entradas);

        // sincronizar via self.proxy → @Transactional realmente aplica.
        // Si falla, dejar burbujear → Spring no arranca y el alerting de
        // Railway lo detecta. Mejor "down" visible que "up" con BBDD a medias.
        self.sincronizar(entradas);

        // Torneos seed: best-effort. No es crítico para servir el API
        // (los torneos UGC y el cron auto pueden regenerar el bracket).
        try (InputStream is = new ClassPathResource(SEED_TORNEOS_FILE).getInputStream()) {
            List<SeedTorneo> torneos = objectMapper.readValue(is, new TypeReference<>() {});
            self.sincronizarTorneos(torneos);
        } catch (Exception e) {
            log.error("DataSeeder fallo al sincronizar {} (no crítico): {}",
                    SEED_TORNEOS_FILE, e.getMessage(), e);
        }

        // Plan v2 §11.8: backfill de códigos de referral. Users pre-V14
        // arrancan sin código; el primer boot tras la migración les asigna
        // uno único. Idempotente: re-ejecutar sobre BBDD ya backfilleada
        // no toca nada.
        try {
            referralService.backfillCodigos();
        } catch (Exception e) {
            log.error("DataSeeder fallo al backfill referral codes (no crítico): {}",
                    e.getMessage(), e);
        }
    }

    /**
     * Valida que el seed no contenga slugs duplicados. Es muy fácil que el
     * script de sync genere duplicados accidentales (variantes de imagen,
     * carpetas con/sin guion bajo). Si dejásemos pasar el seed con dups,
     * el INSERT del primero comitearía y el segundo lanzaría Unique
     * constraint violation a mitad de transacción — peor que el fail-fast.
     */
    private void validarSinDuplicados(List<SeedPersonaje> entradas) {
        Map<String, Integer> count = new HashMap<>();
        for (SeedPersonaje s : entradas) {
            count.merge(s.slug, 1, Integer::sum);
        }
        List<String> dups = count.entrySet().stream()
                .filter(e -> e.getValue() > 1)
                .map(e -> e.getKey() + " (×" + e.getValue() + ")")
                .toList();
        if (!dups.isEmpty()) {
            throw new IllegalStateException(
                    "Seed " + SEED_FILE + " contiene " + dups.size()
                    + " slugs duplicados — regenera con `node scripts/sync-personajes.mjs`. "
                    + "Primeros: " + dups.stream().limit(5).toList());
        }
    }

    /**
     * Hace insert/update/delete en una transacción. Si falla algún paso
     * crítico se hace rollback automático por @Transactional.
     */
    @Transactional
    public void sincronizar(List<SeedPersonaje> entradas) {
        // Index del seed por slug para lookups O(1)
        Map<String, SeedPersonaje> seedPorSlug = new HashMap<>();
        for (SeedPersonaje s : entradas) {
            seedPorSlug.put(s.slug, s);
        }
        Set<String> slugsEnSeed = seedPorSlug.keySet();

        // Personajes actuales en BBDD
        List<Personaje> existentes = personajeRepository.findAll();
        Set<String> slugsExistentes = new HashSet<>();
        for (Personaje p : existentes) slugsExistentes.add(p.getSlug());

        // ─── DELETE: en BBDD pero no en seed ────────────────────────────────
        List<Personaje> aBorrar = new ArrayList<>();
        for (Personaje p : existentes) {
            if (!slugsEnSeed.contains(p.getSlug())) aBorrar.add(p);
        }
        int borrados = 0;
        for (Personaje p : aBorrar) {
            borrados += borrarPersonajeConCascada(p);
        }

        // ─── UPDATE: en ambos pero con campos distintos ────────────────────
        int actualizados = 0;
        for (Personaje p : existentes) {
            SeedPersonaje s = seedPorSlug.get(p.getSlug());
            if (s == null) continue; // ya borrado arriba
            if (aplicarCambios(p, s)) {
                personajeRepository.save(p);
                actualizados++;
            }
        }

        // ─── INSERT: en seed pero no en BBDD ───────────────────────────────
        List<Personaje> nuevos = new ArrayList<>();
        for (SeedPersonaje s : entradas) {
            if (!slugsExistentes.contains(s.slug)) {
                nuevos.add(new Personaje(
                        s.slug,
                        s.nombre,
                        s.anime,
                        s.descripcion,
                        s.imagenUrl != null ? s.imagenUrl : "/img/" + s.slug + ".webp"));
            }
        }
        if (!nuevos.isEmpty()) {
            personajeRepository.saveAll(nuevos);
        }

        log.info(
                "DataSeeder: sincronizado — insertados={}, actualizados={}, borrados={} (seed={}, BBDD antes={})",
                nuevos.size(), actualizados, borrados,
                entradas.size(), existentes.size());
    }

    /**
     * Borra el personaje y todos los datos que lo referencian, en orden:
     * 1. Votos cuyo personaje sea este (Voto.personaje FK).
     * 2. Votos de enfrentamientos donde participe (Voto.enfrentamiento FK
     *    apunta a un enfrentamiento que tiene FK al personaje).
     * 3. Enfrentamientos donde aparezca como personaje1/2/ganador.
     * 4. El personaje en sí.
     *
     * El orden es crítico: si intentamos borrar el personaje antes que sus
     * votos, falla con constraint violation. Devuelve 1 si se borró el
     * personaje. Si algún paso falla, la excepción se propaga para que el
     * @Transactional del método llamante (sincronizar) haga rollback global —
     * preferimos abortar el seed entero a dejar la BBDD con votos huérfanos o
     * enfrentamientos sin personaje.
     */
    private int borrarPersonajeConCascada(Personaje p) {
        int votosBorrados = votoRepository.deleteByPersonajeId(p.getId());
        int votosEnEnfBorrados = votoRepository.deleteVotosEnEnfrentamientosDelPersonaje(p.getId());
        int enfBorrados = enfrentamientoRepository.deleteByPersonajeId(p.getId());
        personajeRepository.delete(p);
        log.info(
                "DataSeeder DELETE: slug={} (votos={}, votosEnEnfrentamientos={}, enfrentamientos={})",
                p.getSlug(), votosBorrados, votosEnEnfBorrados, enfBorrados);
        return 1;
    }

    /**
     * Actualiza el personaje con los valores del seed si difieren. Devuelve
     * true si hubo algún cambio (para decidir si guardar).
     */
    private boolean aplicarCambios(Personaje p, SeedPersonaje s) {
        boolean cambio = false;
        if (!Objects.equals(p.getNombre(), s.nombre)) { p.setNombre(s.nombre); cambio = true; }
        if (!Objects.equals(p.getAnime(), s.anime)) { p.setAnime(s.anime); cambio = true; }
        if (!Objects.equals(p.getDescripcion(), s.descripcion)) { p.setDescripcion(s.descripcion); cambio = true; }
        if (s.imagenUrl != null && !Objects.equals(p.getImagenUrl(), s.imagenUrl)) {
            p.setImagenUrl(s.imagenUrl);
            cambio = true;
        }
        return cambio;
    }

    /** DTO interno para deserializar el JSON. */
    private static class SeedPersonaje {
        public String slug;
        public String nombre;
        public String anime;
        public String descripcion;
        public String imagenUrl;
    }

    // ===================================================================
    //  Torneos seed (Plan v2 §1.1 commit 6)
    // ===================================================================

    /**
     * Sincroniza los 13 torneos de torneos-seed.json. A diferencia de los
     * personajes NO hace DELETE de los torneos no listados — los torneos
     * los crean usuarios o el cron AUTO también, no son solo seed.
     *
     * Comportamiento idempotente por slug:
     *   - Si NO existe: crea Torneo + bracket precomputado vía BracketService.
     *     Si tiene ganadorSlug, asigna Torneo.ganadorPersonaje.
     *   - Si existe: actualiza solo campos meta (nombre, descripcion, estado,
     *     fechas, ganador). NO recrea el bracket — los enfrentamientos
     *     existentes en BBDD son inmutables desde el seed (votos del usuario,
     *     resultados reales).
     */
    @Transactional
    public void sincronizarTorneos(List<SeedTorneo> torneos) {
        Map<String, Personaje> personajesPorSlug = new HashMap<>();
        for (Personaje p : personajeRepository.findAll()) {
            personajesPorSlug.put(p.getSlug(), p);
        }

        int creados = 0;
        int actualizados = 0;
        for (SeedTorneo s : torneos) {
            try {
                if (torneoRepository.existsBySlug(s.slug)) {
                    Torneo existente = torneoRepository.findBySlug(s.slug).orElseThrow();
                    if (aplicarCambiosTorneo(existente, s, personajesPorSlug)) {
                        torneoRepository.save(existente);
                        actualizados++;
                    }
                } else {
                    crearTorneoDesdeSeed(s, personajesPorSlug);
                    creados++;
                }
            } catch (Exception e) {
                log.error("DataSeeder torneo fallo en slug={}: {}", s.slug, e.getMessage(), e);
            }
        }

        log.info("DataSeeder torneos: creados={}, actualizados={} (seed total={})",
                creados, actualizados, torneos.size());
    }

    private void crearTorneoDesdeSeed(SeedTorneo s, Map<String, Personaje> personajesPorSlug) {
        Torneo torneo = new Torneo(s.slug, s.nombre, s.descripcion);
        torneo.setEstado(s.estado != null ? s.estado : EstadoTorneo.SCHEDULED);
        torneo.setFechaInicio(parseFecha(s.fechaInicio));
        torneo.setFechaFinalizacion(parseFecha(s.fechaFinalizacion));
        if (s.ganadorSlug != null) {
            Personaje ganador = personajesPorSlug.get(s.ganadorSlug);
            if (ganador != null) {
                torneo.setGanadorPersonaje(ganador);
            } else {
                log.warn("DataSeeder torneo {}: ganadorSlug={} no existe en BBDD", s.slug, s.ganadorSlug);
            }
        }
        Torneo guardado = torneoRepository.save(torneo);

        // Crea bracket precomputado solo si hay participantes y tamaño válido.
        if (s.participantes != null && !s.participantes.isEmpty()) {
            List<Personaje> participantes = new ArrayList<>();
            for (String slug : s.participantes) {
                Personaje p = personajesPorSlug.get(slug);
                if (p == null) {
                    log.warn("DataSeeder torneo {}: participante slug={} no existe en BBDD, se omite el bracket",
                            s.slug, slug);
                    return;
                }
                participantes.add(p);
            }
            try {
                bracketService.crearBracket(guardado, participantes);
            } catch (IllegalArgumentException e) {
                log.warn("DataSeeder torneo {}: tamaño bracket inválido ({} participantes), bracket no creado",
                        s.slug, participantes.size());
            }
        }

        log.info("DataSeeder torneo INSERT: slug={} estado={} participantes={} ganador={}",
                s.slug, s.estado, s.participantes != null ? s.participantes.size() : 0, s.ganadorSlug);
    }

    private boolean aplicarCambiosTorneo(Torneo p, SeedTorneo s, Map<String, Personaje> personajesPorSlug) {
        boolean cambio = false;
        if (!Objects.equals(p.getNombre(), s.nombre)) { p.setNombre(s.nombre); cambio = true; }
        if (!Objects.equals(p.getDescripcion(), s.descripcion)) { p.setDescripcion(s.descripcion); cambio = true; }
        if (s.estado != null && p.getEstado() != s.estado) { p.setEstado(s.estado); cambio = true; }
        LocalDateTime fechaInicio = parseFecha(s.fechaInicio);
        if (!Objects.equals(p.getFechaInicio(), fechaInicio)) { p.setFechaInicio(fechaInicio); cambio = true; }
        LocalDateTime fechaFin = parseFecha(s.fechaFinalizacion);
        if (!Objects.equals(p.getFechaFinalizacion(), fechaFin)) { p.setFechaFinalizacion(fechaFin); cambio = true; }
        if (s.ganadorSlug != null) {
            Personaje ganador = personajesPorSlug.get(s.ganadorSlug);
            if (ganador != null && (p.getGanadorPersonaje() == null
                    || !Objects.equals(p.getGanadorPersonaje().getId(), ganador.getId()))) {
                p.setGanadorPersonaje(ganador);
                cambio = true;
            }
        }
        return cambio;
    }

    private LocalDateTime parseFecha(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return LocalDateTime.parse(iso);
        } catch (Exception e) {
            log.warn("DataSeeder fecha inválida '{}': {}", iso, e.getMessage());
            return null;
        }
    }

    /** DTO interno para deserializar torneos-seed.json. */
    private static class SeedTorneo {
        public String slug;
        public String nombre;
        public String descripcion;
        public EstadoTorneo estado;
        public String fechaInicio;
        public String fechaFinalizacion;
        public List<String> participantes;
        public String ganadorSlug;
    }
}
