package com.diegoalegil.animeshowdown.model;

public enum CartaShowcaseSlot {
    PERFIL,
    DUEL_SKIN,
    SALON_1,
    SALON_2,
    SALON_3;

    public boolean esSalon() {
        return name().startsWith("SALON_");
    }
}
