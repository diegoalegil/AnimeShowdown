package com.diegoalegil.animeshowdown.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Datos dinámicos para el sitemap.
 *
 * <p>Lo consume el script {@code scripts/generate-sitemap.mjs} en build-time
 * para incluir torneos APROBADO/NO_APLICA (los nuevos por user §4.9, no
 * solo los del seed estático) y perfiles públicos de usuarios verificados
 * (§4.5).
 *
 * <p>JSON ligero (slug + lastmod) — el script genera el XML final con
 * priority / changefreq decididos cliente. Cache short por header
 * (Cache-Control) para que Cloudflare lo cachee 5 minutos: el build de
 * Pages tarda <2min y un caché de 5 amortiza picos sin desincronizar.
 */
@RestController
@RequestMapping("/api/sitemap")
public class SitemapController {

    private final TorneoRepository torneoRepository;
    private final UsuarioRepository usuarioRepository;

    public SitemapController(
            TorneoRepository torneoRepository,
            UsuarioRepository usuarioRepository) {
        this.torneoRepository = torneoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    /**
     * Devuelve la lista de torneos visibles públicamente (APROBADO + NO_APLICA)
     * + lista de usernames con perfil público. Sin auth — el sitemap es
     * público por definición y los crawlers de Google no llevan token.
     */
    @GetMapping(value = "/data", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> data() {
        List<Map<String, Object>> torneos = torneoRepository.findVisiblesPublico()
                .stream()
                .map(this::torneoEntry)
                .toList();

        // Todos los usuarios — el perfil público es accesible vía username.
        // Si en el futuro queremos filtrar por usuarios "activos" (que han
        // votado al menos una vez) se cambia esta lectura por una query
        // específica. Por ahora la lista entera es manejable (decenas).
        List<Map<String, Object>> usuarios = usuarioRepository.findAll()
                .stream()
                .map(this::usuarioEntry)
                .toList();

        return ResponseEntity
                .ok()
                .header("Cache-Control", "public, max-age=300")
                .body(Map.of("torneos", torneos, "usuarios", usuarios));
    }

    private Map<String, Object> torneoEntry(Torneo t) {
        // lastmod: prioriza fechaFinalizacion sobre fechaInicio sobre creación.
        // Esto le dice al crawler "este torneo ya terminó / sigue activo /
        // se acaba de publicar" para que pueda repriorizar el recrawl.
        Object lastmod = t.getFechaFinalizacion();
        if (lastmod == null) lastmod = t.getFechaInicio();
        if (lastmod == null) lastmod = t.getFechaCreacion();
        return Map.of(
                "slug", t.getSlug(),
                "lastmod", lastmod == null ? "" : lastmod.toString(),
                // Marcamos los UGC para que el script les pueda dar otra
                // priority (los admin son más estables y autoritativos).
                "esDeUsuario", t.getEstadoRevision() != EstadoRevision.NO_APLICA);
    }

    private Map<String, Object> usuarioEntry(Usuario u) {
        return Map.of(
                "username", u.getUsername(),
                "lastmod", u.getFechaRegistro() == null ? "" : u.getFechaRegistro().toString());
    }
}
