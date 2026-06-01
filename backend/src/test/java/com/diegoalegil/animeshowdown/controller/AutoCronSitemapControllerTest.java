package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.TorneoAutoService;

/**
 * Cobertura de los controllers de auto-generación de torneos (admin + cron) y
 * del endpoint de datos del sitemap.
 *
 * <p>El happy-path con audit de {@code AutoTorneoController.autoGenerar} ya lo
 * cubre {@code AdminAuditControllerTest}; aquí cubrimos las ramas restantes
 * (deshabilitado, idempotencia, historial) y el endpoint cron-only con su
 * verificación de secret, que no estaba testeado en ningún lado.
 */
class AutoCronSitemapControllerTest {

    private static Torneo torneo(Long id, String slug) {
        Torneo t = new Torneo();
        t.setId(id);
        t.setSlug(slug);
        t.setNombre("Torneo " + slug);
        return t;
    }

    // ─── AutoTorneoController ────────────────────────────────────────────

    @Test
    void autoGenerarDevuelve503CuandoDeshabilitado() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        when(auto.isEnabled()).thenReturn(false);
        AutoTorneoController controller = new AutoTorneoController(auto, mock(AuditLogService.class));

        ResponseEntity<?> resp = controller.autoGenerar(Map.of(), new Usuario(), new MockHttpServletRequest());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void autoGenerarDevuelve409EnIdempotencia() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        when(auto.isEnabled()).thenReturn(true);
        Torneo existente = torneo(3L, "ya-existe");
        when(auto.generar(anyInt(), anyBoolean()))
                .thenThrow(new TorneoAutoService.IdempotenciaException("ya hay uno reciente", existente));
        AutoTorneoController controller = new AutoTorneoController(auto, mock(AuditLogService.class));

        ResponseEntity<?> resp = controller.autoGenerar(Map.of(), new Usuario(), new MockHttpServletRequest());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void autoGenerarDevuelve400EnEstadoInvalido() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        when(auto.isEnabled()).thenReturn(true);
        when(auto.generar(anyInt(), anyBoolean())).thenThrow(new IllegalStateException("no hay personajes"));
        AutoTorneoController controller = new AutoTorneoController(auto, mock(AuditLogService.class));

        ResponseEntity<?> resp = controller.autoGenerar(Map.of(), new Usuario(), new MockHttpServletRequest());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void autoHistorialReportaEstadoYrecienteNullable() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        when(auto.isEnabled()).thenReturn(true);
        when(auto.torneoAutoReciente()).thenReturn(Optional.empty());
        AutoTorneoController controller = new AutoTorneoController(auto, mock(AuditLogService.class));

        ResponseEntity<?> resp = controller.autoHistorial();

        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("auto_enabled")).isEqualTo(true);
        assertThat(body.get("torneo_reciente_24h")).isNull();
    }

    // ─── CronTorneoController ────────────────────────────────────────────

    @Test
    void cronDevuelve401SinSecretConfigurado() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        CronTorneoController controller = new CronTorneoController(auto, "");

        ResponseEntity<?> resp = controller.autoGenerar("cualquier-cosa", Map.of());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void cronDevuelve401ConSecretIncorrecto() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        CronTorneoController controller = new CronTorneoController(auto, "secreto-real");

        ResponseEntity<?> resp = controller.autoGenerar("secreto-falso", Map.of());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void cronConSecretValidoPeroDeshabilitadoDevuelve503() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        when(auto.isEnabled()).thenReturn(false);
        CronTorneoController controller = new CronTorneoController(auto, "secreto-real");

        ResponseEntity<?> resp = controller.autoGenerar("secreto-real", Map.of());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void cronConSecretValidoYhabilitadoGenera201() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        when(auto.isEnabled()).thenReturn(true);
        when(auto.generar(anyInt(), anyBoolean())).thenReturn(torneo(5L, "cron-creado"));
        CronTorneoController controller = new CronTorneoController(auto, "secreto-real");

        ResponseEntity<?> resp = controller.autoGenerar("secreto-real", Map.of("tamano", 16, "force", true));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void cronConSecretValidoEnIdempotenciaDevuelve409() {
        TorneoAutoService auto = mock(TorneoAutoService.class);
        when(auto.isEnabled()).thenReturn(true);
        when(auto.generar(anyInt(), anyBoolean()))
                .thenThrow(new TorneoAutoService.IdempotenciaException("reciente", torneo(6L, "existente")));
        CronTorneoController controller = new CronTorneoController(auto, "secreto-real");

        ResponseEntity<?> resp = controller.autoGenerar("secreto-real", Map.of());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    // ─── SitemapController ───────────────────────────────────────────────

    @Test
    void sitemapDataDevuelveTorneosYusuariosConCacheHeader() {
        TorneoRepository torneoRepo = mock(TorneoRepository.class);
        UsuarioRepository usuarioRepo = mock(UsuarioRepository.class);
        when(torneoRepo.findVisiblesPublico()).thenReturn(List.of());
        when(usuarioRepo.findAll()).thenReturn(List.of());
        SitemapController controller = new SitemapController(torneoRepo, usuarioRepo);

        ResponseEntity<Map<String, Object>> resp = controller.data();

        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        assertThat(resp.getHeaders().getCacheControl()).contains("max-age=300");
        Map<String, Object> body = resp.getBody();
        assertThat(body).isNotNull();
        assertThat(body).containsKeys("torneos", "usuarios");
    }
}
