package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.SugerenciaPersonajeDto;
import com.diegoalegil.animeshowdown.dto.SugerirPersonajeRequest;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Notificacion;
import com.diegoalegil.animeshowdown.model.SugerenciaEstado;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.NotificacionRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
class SugerenciaPersonajeServiceTest {

    @Autowired private SugerenciaPersonajeService service;
    @Autowired private UsuarioRepository usuarioRepo;
    @Autowired private NotificacionRepository notificacionRepo;

    private Usuario crearUsuario(String base) {
        String username = base + "_" + System.nanoTime();
        Usuario u = new Usuario(username, "{noop}secreta123", username + "@test.com");
        u.setEloPvp(1000);
        return usuarioRepo.save(u);
    }

    private SugerirPersonajeRequest req(String nombre, String anime, String identidad) {
        return new SugerirPersonajeRequest(nombre, anime, null, identidad, null);
    }

    @Test
    void crearGuardaComoPendiente() {
        Usuario u = crearUsuario("sug_ok");
        SugerenciaPersonajeDto dto = service.crear(req("Spike", "Cowboy Bebop", "https://myanimelist.net/character/1"), u);

        assertThat(dto.id()).isNotNull();
        assertThat(dto.estado()).isEqualTo("PENDIENTE");
        assertThat(dto.proponente()).isEqualTo(u.getUsername());
        assertThat(service.listarMias(u, 0, 10).getTotalElements()).isEqualTo(1);
    }

    @Test
    void rechazaIdentidadGenerica() {
        Usuario u = crearUsuario("sug_generica");
        assertThatThrownBy(() -> service.crear(req("Random", "Anime X", "anime"), u))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }

    @Test
    void rechazaIdentidadDemasiadoCorta() {
        Usuario u = crearUsuario("sug_corta");
        assertThatThrownBy(() -> service.crear(req("X", "Anime", "ab"), u))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }

    @Test
    void aplicaRateLimitPorHora() {
        Usuario u = crearUsuario("sug_rate");
        // Default app.sugerencias.rate-limit-per-hour=3.
        service.crear(req("A", "Anime", "識別子-A"), u);
        service.crear(req("B", "Anime", "識別子-B"), u);
        service.crear(req("C", "Anime", "識別子-C"), u);
        assertThatThrownBy(() -> service.crear(req("D", "Anime", "識別子-D"), u))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
    }

    @Test
    void aprobarTransicionaYNotifica() {
        Usuario u = crearUsuario("sug_aprob");
        SugerenciaPersonajeDto creada = service.crear(req("Makima", "Chainsaw Man", "マキマ"), u);

        SugerenciaPersonajeDto aprobada = service.aprobar(creada.id());

        assertThat(aprobada.estado()).isEqualTo("APROBADO");
        assertThat(aprobada.revisadoEn()).isNotNull();
        assertThat(tiposNotificacion(u)).contains(NotificacionTipo.SUGERENCIA_APROBADA);
    }

    @Test
    void rechazarGuardaMotivoYNotifica() {
        Usuario u = crearUsuario("sug_rech");
        SugerenciaPersonajeDto creada = service.crear(req("Generico", "Anime", "識別子"), u);

        SugerenciaPersonajeDto rechazada = service.rechazar(creada.id(), "Ya existe en el catálogo.");

        assertThat(rechazada.estado()).isEqualTo("RECHAZADO");
        assertThat(rechazada.motivoRechazo()).isEqualTo("Ya existe en el catálogo.");
        assertThat(tiposNotificacion(u)).contains(NotificacionTipo.SUGERENCIA_RECHAZADA);
    }

    @Test
    void noSePuedeModerarDosVeces() {
        Usuario u = crearUsuario("sug_doble");
        SugerenciaPersonajeDto creada = service.crear(req("Aki", "Chainsaw Man", "早川アキ"), u);
        service.aprobar(creada.id());

        assertThatThrownBy(() -> service.aprobar(creada.id()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    private java.util.List<NotificacionTipo> tiposNotificacion(Usuario u) {
        return notificacionRepo.findByUsuarioOrderByCreadoEnDesc(u, PageRequest.of(0, 10))
                .getContent().stream().map(Notificacion::getTipo).toList();
    }
}
