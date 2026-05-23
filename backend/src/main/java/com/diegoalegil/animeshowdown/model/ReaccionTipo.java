package com.diegoalegil.animeshowdown.model;

/**
 * Los 4 emojis fijos de reactions.
 *
 * <p>El cliente envía estos códigos en el body de POST /api/reacciones;
 * el frontend mapea cada uno al emoji visual al pintar.
 * <ul>
 *   <li>{@link #FIRE}  🔥 — viral / impactante / cool</li>
 *   <li>{@link #HEART} ❤️ — me encanta / favorito</li>
 *   <li>{@link #LAUGH} 😂 — divertido / payaso</li>
 *   <li>{@link #CRY}   😢 — me pone triste / lástima</li>
 * </ul>
 */
public enum ReaccionTipo {
    FIRE,
    HEART,
    LAUGH,
    CRY
}
