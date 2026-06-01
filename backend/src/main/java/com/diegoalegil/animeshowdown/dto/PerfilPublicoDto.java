package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Vista pública agregada del perfil de un usuario.
 *
 * <p>Una sola llamada {@code GET /api/perfil/{username}} devuelve todo
 * lo que la página /u/{username} necesita pintar — evita 3-4 round-trips
 * separados. No expone email, password ni datos sensibles.
 *
 * <ul>
 *   <li>{@code siguiendo} — el caller (si está autenticado) sigue a este
 *       usuario. null si no hay caller autenticado.</li>
 *   <li>{@code esMismoUsuario} — el caller es el propio dueño. Para que
 *       el frontend oculte el botón "Seguir" en su propio perfil.</li>
 *   <li>{@code stats}, {@code top}, {@code logros} — sub-objetos con la
 *       data del bloque correspondiente. {@code logros} solo incluye los
 *       DESBLOQUEADOS (no el catálogo entero como hace /api/logros/mios).</li>
 * </ul>
 */
public record PerfilPublicoDto(
        Long id,
        String username,
        String avatarUrl,
        String bannerUrl,
        String bio,
        LocalDateTime fechaRegistro,
        long seguidores,
        long seguidos,
        Boolean siguiendo,
        boolean esMismoUsuario,
        PerfilStatsDto stats,
        List<TopPersonajeItem> top,
        List<LogroDto> logros,
        List<CartaShowcaseDto> showcases) {
}
