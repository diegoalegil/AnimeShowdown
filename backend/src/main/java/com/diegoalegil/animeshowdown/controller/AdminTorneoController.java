package com.diegoalegil.animeshowdown.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.diegoalegil.animeshowdown.dto.TorneoMioDto;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.service.TorneoService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Cola admin de torneos creados por usuarios.
 *
 * <p>Todos los endpoints exigen rol ADMIN — `/api/admin/**` está protegido
 * en {@code SecurityConfig}. El admin ve los pendientes FIFO, aprueba (que
 * además los inicia automáticamente) o rechaza con motivo. Las decisiones
 * disparan notificaciones in-app al creador vía {@code TorneoService}.
 */
@RestController
@RequestMapping("/api/admin/torneos")
public class AdminTorneoController {

    private final TorneoService torneoService;

    public AdminTorneoController(TorneoService torneoService) {
        this.torneoService = torneoService;
    }

    @GetMapping("/pendientes")
    public List<TorneoMioDto> listarPendientes() {
        return torneoService.listarPendientesRevision().stream()
                .map(TorneoMioDto::from)
                .toList();
    }

    @PutMapping("/{id}/aprobar")
    public ResponseEntity<Torneo> aprobar(@PathVariable Long id) {
        return ResponseEntity.ok(torneoService.aprobar(id));
    }

    @PutMapping("/{id}/rechazar")
    public ResponseEntity<Torneo> rechazar(
            @PathVariable Long id,
            @Valid @RequestBody RechazoRequest body) {
        return ResponseEntity.ok(torneoService.rechazar(id, body.getMotivo()));
    }

    /**
     * Body del PUT /rechazar — campo único {@code motivo} con tamaño
     * acotado para que el creador lo lea sin scroll y para no almacenar
     * párrafos arbitrarios en una columna TEXT abierta.
     */
    public static class RechazoRequest {
        @NotBlank(message = "El motivo es obligatorio")
        @Size(min = 5, max = 500, message = "El motivo debe tener entre 5 y 500 caracteres")
        private String motivo;

        public String getMotivo() {
            return motivo;
        }

        public void setMotivo(String motivo) {
            this.motivo = motivo;
        }
    }
}
