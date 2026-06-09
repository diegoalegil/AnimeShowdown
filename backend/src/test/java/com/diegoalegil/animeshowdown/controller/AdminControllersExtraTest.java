package com.diegoalegil.animeshowdown.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.ResponseEntity;

import com.diegoalegil.animeshowdown.controller.AdminAssetController.AssetCoverageResponse;
import com.diegoalegil.animeshowdown.model.EmailFailure;
import com.diegoalegil.animeshowdown.repository.EmailFailureRepository;
import com.diegoalegil.animeshowdown.service.AuditLogService;
import com.diegoalegil.animeshowdown.service.JikanService;
import com.diegoalegil.animeshowdown.service.TorneoService;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Cobertura de endpoints admin que no toca {@code AdminAuditControllerTest}
 * (que cubre las mutaciones con audit).
 * Aquí van los GET de solo lectura: dead-letter de emails, cola pendiente
 * de torneos y el dashboard de cobertura de assets.
 *
 * <p>Patrón del repo: unit test directo con Mockito (no {@code @WebMvcTest}),
 * instanciando el controller con dependencias mockeadas.
 */
class AdminControllersExtraTest {

    @Test
    void listarEmailFailuresAgregaTotalesYpendientes() {
        EmailFailureRepository repo = mock(EmailFailureRepository.class);
        AdminController controller = new AdminController(
                mock(JikanService.class), repo, mock(AuditLogService.class));
        EmailFailure f1 = new EmailFailure();
        EmailFailure f2 = new EmailFailure();
        when(repo.findAllByOrderByTsDesc()).thenReturn(List.of(f1, f2));
        when(repo.countByReintentadoFalse()).thenReturn(1L);

        ResponseEntity<Map<String, Object>> resp = controller.listarEmailFailures();

        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = resp.getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("total")).isEqualTo(2);
        assertThat(body.get("pendientesReintento")).isEqualTo(1L);
        // Vista REDACTADA: nunca la entidad cruda (arrastra cuerpo HTML y
        // tokens de verificación/reset embebidos en los links).
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fallos = (List<Map<String, Object>>) body.get("fallos");
        assertThat(fallos).hasSize(2);
        assertThat(fallos.get(0)).containsKeys("id", "ts", "tipo", "destinatario", "errorMsg", "reintentado");
        assertThat(fallos.get(0)).doesNotContainKeys("contenido", "asunto");
    }

    @Test
    void listarEmailFailuresConColaVaciaDevuelveCeros() {
        EmailFailureRepository repo = mock(EmailFailureRepository.class);
        AdminController controller = new AdminController(
                mock(JikanService.class), repo, mock(AuditLogService.class));
        when(repo.findAllByOrderByTsDesc()).thenReturn(List.of());
        when(repo.countByReintentadoFalse()).thenReturn(0L);

        Map<String, Object> body = controller.listarEmailFailures().getBody();

        assertThat(body).isNotNull();
        assertThat(body.get("total")).isEqualTo(0);
        assertThat(body.get("pendientesReintento")).isEqualTo(0L);
    }

    @Test
    void listarPendientesDelegaEnServiceYMapeaVacio() {
        TorneoService torneoService = mock(TorneoService.class);
        AdminTorneoController controller = new AdminTorneoController(
                torneoService, mock(AuditLogService.class));
        when(torneoService.listarPendientesRevision()).thenReturn(List.of());

        assertThat(controller.listarPendientes()).isEmpty();
    }

    @Test
    void coverageDevuelveEstructuraConBucketsCuandoSeedsVacios() throws Exception {
        ResourceLoader loader = mock(ResourceLoader.class);
        Resource resource = mock(Resource.class);
        when(loader.getResource(anyString())).thenReturn(resource);
        // getInputStream se invoca una vez por seed (personajes + torneos).
        // thenAnswer entrega un stream fresco en cada llamada para no agotarlo.
        when(resource.getInputStream())
                .thenAnswer(inv -> new ByteArrayInputStream("[]".getBytes(StandardCharsets.UTF_8)));

        AdminAssetController controller = new AdminAssetController(new ObjectMapper(), loader);
        AssetCoverageResponse resp = controller.coverage();

        assertThat(resp).isNotNull();
        assertThat(resp.totalSlots()).isZero();
        assertThat(resp.realAssets()).isZero();
        // 5 buckets fijos: character-cards, portraits, banners, anime, tournaments.
        assertThat(resp.buckets()).hasSize(5);
        assertThat(resp.generatedAt()).isNotNull();
    }
}
