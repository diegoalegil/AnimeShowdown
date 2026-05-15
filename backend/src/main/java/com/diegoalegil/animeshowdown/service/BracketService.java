package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;

/**
 * Construye y mantiene la estructura de un bracket de eliminación directa.
 *
 * El frontend (Bracket.jsx) hoy computa las rondas localmente a partir
 * de un array de participantes ordenado por ELO. El Plan v2 §1.1 mueve
 * esa verdad al backend: cuando se inicia un torneo de N personajes
 * (N potencia de 2), se persisten en BBDD log2(N) rondas en cascada:
 *
 *   tamaño=16 → ronda 1: 8 matches, ronda 2: 4, ronda 3: 2, ronda 4 (final): 1
 *   tamaño=8  → ronda 1: 4 matches, ronda 2: 2, ronda 3 (final): 1
 *
 * Solo la ronda 1 lleva personajes; las rondas 2+ se crean con
 * personaje1=null, personaje2=null. Cuando se cierra una ronda
 * (commit 4.5: BracketAvanceScheduler), los ganadores rellenan los
 * slots de la siguiente.
 *
 * Mapping entre rondas: para un match con index `i` (0-based) dentro de
 * su ronda, el ganador va al match `i/2` de la ronda siguiente. Si i es
 * par → slot personaje1; si es impar → slot personaje2. Esto preserva
 * el orden visual del bracket (top → top, bottom → bottom).
 */
@Service
public class BracketService {

    private static final Logger log = LoggerFactory.getLogger(BracketService.class);
    private static final int TAMANO_MINIMO = 4;
    private static final int TAMANO_MAXIMO = 64;

    private final EnfrentamientoRepository enfrentamientoRepository;

    public BracketService(EnfrentamientoRepository enfrentamientoRepository) {
        this.enfrentamientoRepository = enfrentamientoRepository;
    }

    /**
     * Crea el bracket completo en cascada para un torneo recién iniciado.
     * Solo persiste los Enfrentamiento — no modifica el estado del torneo
     * (eso es responsabilidad de TorneoService.iniciar).
     *
     * Pre: lista de participantes tamaño potencia de 2, entre 4 y 64.
     * Post: ronda 1 con personajes reales, rondas 2..log2(N) con slots vacíos.
     *
     * @return los enfrentamientos creados, ordenados por ronda y luego por
     *         orden de inserción (que coincide con el orden visual del bracket).
     */
    @Transactional
    public List<Enfrentamiento> crearBracket(Torneo torneo, List<Personaje> participantes) {
        validarTamano(participantes.size());
        int tamano = participantes.size();
        int totalRondas = log2(tamano);

        List<Enfrentamiento> creados = new ArrayList<>();

        // Ronda 1: empareja 0vs1, 2vs3, 4vs5, ... preservando el orden de
        // entrada. Si el caller quiere seeding por ELO debe pasar la lista
        // ya ordenada — BracketService no impone política de emparejamiento.
        for (int i = 0; i < tamano; i += 2) {
            Personaje p1 = participantes.get(i);
            Personaje p2 = participantes.get(i + 1);
            if (p1.getId().equals(p2.getId())) {
                throw new IllegalArgumentException(
                        "Un personaje no puede enfrentarse a sí mismo en el bracket (slug=" + p1.getSlug() + ")");
            }
            Enfrentamiento match = new Enfrentamiento(torneo, p1, p2, 1);
            creados.add(enfrentamientoRepository.save(match));
        }

        // Rondas 2..total: matches vacíos. La cantidad por ronda se divide
        // por 2 en cada nivel. El último nivel es la final (1 match).
        int matchesEnRonda = tamano / 4;
        for (int ronda = 2; ronda <= totalRondas; ronda++) {
            for (int i = 0; i < matchesEnRonda; i++) {
                Enfrentamiento vacio = new Enfrentamiento(torneo, null, null, ronda);
                creados.add(enfrentamientoRepository.save(vacio));
            }
            matchesEnRonda /= 2;
        }

        log.info("Bracket creado para torneo {}: {} participantes, {} rondas, {} matches totales",
                torneo.getSlug(), tamano, totalRondas, creados.size());
        return creados;
    }

    /**
     * Total de rondas de un torneo de `tamano` participantes (potencia de 2).
     * Útil para el DTO de respuesta que expone `totalRondas` al frontend.
     */
    public int totalRondas(int tamano) {
        validarTamano(tamano);
        return log2(tamano);
    }

    private void validarTamano(int tamano) {
        if (tamano < TAMANO_MINIMO || tamano > TAMANO_MAXIMO) {
            throw new IllegalArgumentException(
                    "Tamaño de bracket fuera de rango [" + TAMANO_MINIMO + "," + TAMANO_MAXIMO + "]: " + tamano);
        }
        if ((tamano & (tamano - 1)) != 0) {
            throw new IllegalArgumentException(
                    "Tamaño de bracket debe ser potencia de 2: " + tamano);
        }
    }

    private int log2(int n) {
        return Integer.numberOfTrailingZeros(n);
    }
}
