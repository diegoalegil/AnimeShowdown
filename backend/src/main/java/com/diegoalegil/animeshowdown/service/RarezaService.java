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
 * En Fase 1 el dropper SÓLO reparte SSR (todas las cartas normales) — las
 * ESPECIAL son premio curado fuera del sobre — así que un sobre da SSR al 100%
 * y, dentro de SSR, cada personaje es equiprobable.
 */
@Service
public class RarezaService {

    /** Única rareza que entra en los sobres en F1. */
    private static final RarezaCarta RAREZA_SOBRE = RarezaCarta.SSR;

    private final CartaRepository cartaRepo;
    private final long precioSobre;

    public RarezaService(CartaRepository cartaRepo,
            @Value("${app.cartas.sobre.precio:100}") long precioSobre) {
        this.cartaRepo = cartaRepo;
        this.precioSobre = Math.max(1, precioSobre);
    }

    public long precioSobre() {
        return precioSobre;
    }

    /** Odds transparentes para la UI: precio, tamaño del pool y prob. por rareza. */
    @Transactional(readOnly = true)
    public OddsDto odds() {
        int pool = (int) cartaRepo.countByRareza(RAREZA_SOBRE);
        List<OddsDto.RarezaOdds> rarezas = List.of(
                new OddsDto.RarezaOdds(RAREZA_SOBRE, 1.0, "Carta SSR — cada personaje equiprobable"));
        return new OddsDto(precioSobre, pool, rarezas);
    }

    /**
     * Elige al azar una carta SSR del catálogo. El servidor es la única
     * autoridad: el cliente nunca decide. Lanza 503 si el catálogo está vacío
     * (no debería: CartaCatalogoService lo siembra en el arranque).
     */
    @Transactional(readOnly = true)
    public Carta elegirCartaDeSobre() {
        List<Long> ids = cartaRepo.findIdsByRareza(RAREZA_SOBRE);
        if (ids.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El catálogo de cartas aún no está disponible");
        }
        Long elegido = ids.get(ThreadLocalRandom.current().nextInt(ids.size()));
        return cartaRepo.findById(elegido)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Carta no encontrada al abrir el sobre"));
    }
}
