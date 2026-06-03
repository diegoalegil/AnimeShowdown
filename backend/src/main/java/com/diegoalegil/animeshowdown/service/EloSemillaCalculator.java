package com.diegoalegil.animeshowdown.service;

/**
 * Calcula la ELO semilla de un personaje a partir de su popularidad real
 * (favourites de AniList/MAL) y su género. Función PURA y estática: sin estado
 * ni dependencias → 100% unit-testeable, y se reutiliza desde el servicio de
 * seeding y los tests sin tocar red ni BBDD.
 *
 * <p>Fórmula: {@code seed = floor + factor·log10(favAjustados + 1)}, acotada a
 * {@code [floor, ceiling]}, donde {@code favAjustados = favourites · (F ? 1.15 :
 * 1)}. El ajuste de género (×1.15 a personajes femeninos) se aplica sobre los
 * favourites ANTES del log10 — así desplaza la posición sin inflar el techo: el
 * bonus es perceptible en la franja media (personajes de nicho), no en los
 * megapopulares que topan igual. Sin datos (favourites null/≤0) → {@code floor}
 * (neutro, indistinguible del cold-start; correcto para personajes sin match).
 */
public final class EloSemillaCalculator {

    private EloSemillaCalculator() {
    }

    /** Parámetros de la curva. Tunables sin tocar la fórmula (los inyecta el servicio vía @Value). */
    public record Params(double factor, int floor, int ceiling, double bonusFemenino) {
        /** Defaults propuestos: suelo 1500, techo 1900, factor 120, +15% femenino. */
        public static final Params DEFECTO = new Params(120.0, 1500, 1900, 1.15);
    }

    /** Semilla con los parámetros por defecto. */
    public static int calcular(Integer favourites, String genero) {
        return calcular(favourites, genero, Params.DEFECTO);
    }

    public static int calcular(Integer favourites, String genero, Params p) {
        if (favourites == null || favourites <= 0) {
            return p.floor();
        }
        double multiplicador = "F".equalsIgnoreCase(genero) ? p.bonusFemenino() : 1.0;
        double favAjustados = favourites * multiplicador;
        long seed = Math.round(p.floor() + p.factor() * Math.log10(favAjustados + 1.0));
        return (int) Math.max(p.floor(), Math.min(p.ceiling(), seed));
    }
}
