package com.diegoalegil.animeshowdown.service;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.OddsDto;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;

/**
 * Probabilidades de los sobres y elección server-authoritative de la carta.
 *
 * <p>Anti-casino: las odds son TRANSPARENTES y se exponen tal cual al cliente.
 * En Fase 2 cada sobre trae 4 cartas normales SSR y un slot clímax: SSR top o,
 * con odds transparentes + pity server-side, una ESPECIAL curada.
 */
@Service
public class RarezaService {

    public static final int CARTAS_POR_SOBRE = 5;
    public static final int NORMALES_POR_SOBRE = 4;

    private final CartaRepository cartaRepo;
    private final long precioSobre;
    private final double probabilidadEspecialBase;
    private final int pityDuro;

    public RarezaService(CartaRepository cartaRepo,
            @Value("${app.cartas.sobre.precio:100}") long precioSobre,
            @Value("${app.cartas.especial.probabilidad-base:0.05}") double probabilidadEspecialBase,
            @Value("${app.cartas.especial.pity-duro:10}") int pityDuro) {
        this.cartaRepo = cartaRepo;
        this.precioSobre = Math.max(1, precioSobre);
        this.probabilidadEspecialBase = Math.max(0.0, Math.min(1.0, probabilidadEspecialBase));
        this.pityDuro = Math.max(1, pityDuro);
    }

    public long precioSobre() {
        return precioSobre;
    }

    public int pityDuro() {
        return pityDuro;
    }

    /** Odds transparentes para la UI: precio, tamaño del pool y prob. por rareza. */
    @Transactional(readOnly = true)
    public OddsDto odds() {
        int poolSsr = (int) cartaRepo.countByRareza(RarezaCarta.SSR);
        int poolEspecial = (int) cartaRepo.countByRareza(RarezaCarta.ESPECIAL);
        List<OddsDto.RarezaOdds> rarezas = List.of(
                new OddsDto.RarezaOdds(RarezaCarta.SSR, 1.0,
                        "4 cartas normales + clímax top si no sale especial"),
                new OddsDto.RarezaOdds(RarezaCarta.ESPECIAL, probabilidadEspecialBase,
                        "Slot clímax: 5% base y pity duro al sobre 10 sin especial"));
        return new OddsDto(precioSobre, poolSsr + poolEspecial, CARTAS_POR_SOBRE,
                NORMALES_POR_SOBRE, probabilidadEspecialBase, pityDuro, rarezas);
    }

    /**
     * Elige las 4 cartas normales y el clímax. El servidor es la única autoridad:
     * el cliente nunca decide el contenido del sobre.
     */
    @Transactional(readOnly = true)
    public SobreDraw elegirSobre(boolean especial) {
        List<Long> ssrIds = cartaRepo.findIdsByRareza(RarezaCarta.SSR);
        if (ssrIds.size() < CARTAS_POR_SOBRE) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El catálogo de cartas aún no está disponible");
        }
        List<Carta> normales = elegirDistintas(ssrIds, NORMALES_POR_SOBRE);
        Carta climax;
        boolean especialReal = false;
        if (especial) {
            List<Long> especiales = cartaRepo.findIdsEspecialesCuradas(RarezaCarta.ESPECIAL);
            if (!especiales.isEmpty()) {
                climax = materializar(especiales.get(ThreadLocalRandom.current().nextInt(especiales.size())));
                especialReal = true;
            } else {
                climax = elegirDistintas(ssrIds.stream()
                        .filter(id -> normales.stream().noneMatch(c -> c.getId().equals(id)))
                        .toList(), 1).getFirst();
            }
        } else {
            climax = elegirDistintas(ssrIds.stream()
                    .filter(id -> normales.stream().noneMatch(c -> c.getId().equals(id)))
                    .toList(), 1).getFirst();
        }
        return new SobreDraw(normales, climax, especialReal);
    }

    public boolean debeSalirEspecial(int sobresSinEspecial) {
        if (cartaRepo.countByRareza(RarezaCarta.ESPECIAL) <= 0) {
            return false;
        }
        if (sobresSinEspecial >= pityDuro - 1) {
            return true;
        }
        return ThreadLocalRandom.current().nextDouble() < probabilidadEspecialBase;
    }

    private List<Carta> elegirDistintas(List<Long> ids, int cantidad) {
        if (ids.size() < cantidad) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No hay suficientes cartas disponibles");
        }
        java.util.ArrayList<Long> copia = new java.util.ArrayList<>(ids);
        java.util.Collections.shuffle(copia);
        return copia.stream().limit(cantidad).map(this::materializar).toList();
    }

    private Carta materializar(Long elegido) {
        return cartaRepo.findById(elegido)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Carta no encontrada al abrir el sobre"));
    }

    public record SobreDraw(List<Carta> normales, Carta climax, boolean especial) {
    }
}
