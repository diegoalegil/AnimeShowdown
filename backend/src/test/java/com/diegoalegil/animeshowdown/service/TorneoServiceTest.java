package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.diegoalegil.animeshowdown.dto.TorneoCrearMioRequest;
import com.diegoalegil.animeshowdown.dto.TorneoCrearRequest;
import com.diegoalegil.animeshowdown.dto.TorneoIniciarRequest;
import com.diegoalegil.animeshowdown.model.EstadoRevision;
import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.EstadoVerificacion;
import com.diegoalegil.animeshowdown.model.NotificacionTipo;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Rol;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.EnfrentamientoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

import jakarta.persistence.EntityNotFoundException;

@ExtendWith(MockitoExtension.class)
class TorneoServiceTest {

    @Mock private TorneoRepository torneoRepository;
    @Mock private EnfrentamientoRepository enfrentamientoRepository;
    @Mock private PersonajeRepository personajeRepository;
    @Mock private VotoRepository votoRepository;
    @Mock private BracketService bracketService;
    @Mock private BracketAdvanceService bracketAdvanceService;
    @Mock private PrediccionService prediccionService;
    @Mock private NotificacionService notificacionService;
    @Mock private IndexNowService indexNowService;
    @Mock private SeguidorFanOutService seguidorFanOutService;
    @Mock private TorneoCreationLock torneoCreationLock;
    @Mock private TorneoOperacionLockService torneoOperacionLockService;
    @Mock private EventoRecompensaService eventoRecompensaService;

    private TorneoService service;

    @BeforeEach
    void setUp() {
        service = new TorneoService(
                torneoRepository,
                enfrentamientoRepository,
                personajeRepository,
                votoRepository,
                bracketService,
                bracketAdvanceService,
                prediccionService,
                notificacionService,
                indexNowService,
                seguidorFanOutService,
                torneoCreationLock,
                torneoOperacionLockService,
                eventoRecompensaService);
    }

    // ─── Fixtures ──────────────────────────────────────────────────────────────

    private static Usuario makeUsuario(Long id, String username, EstadoVerificacion verif) {
        Usuario u = new Usuario(username, "{noop}p", username + "@test.com");
        u.setId(id);
        u.setEstadoVerificacion(verif);
        u.setRol(Rol.USER);
        return u;
    }

    private static PersonaBuilder personaje(Long id) { return new PersonaBuilder(id); }
    private static class PersonaBuilder {
        private final Personaje p = new Personaje();
        PersonaBuilder(Long id) { p.setId(id); p.setSlug("p" + id); p.setNombre("P" + id); p.setAnime("A" + id); }
        PersonaBuilder slug(String s) { p.setSlug(s); return this; }
        PersonaBuilder nombre(String n) { p.setNombre(n); return this; }
        PersonaBuilder anime(String a) { p.setAnime(a); return this; }
        Personaje build() { return p; }
    }

    private static TorneroBuilder torneo() { return new TorneroBuilder(); }
    private static class TorneroBuilder {
        private final Torneo t = new Torneo();
        TorneroBuilder() {
            t.setId(1L); t.setSlug("test-slug"); t.setNombre("Test");
            t.setEstado(EstadoTorneo.SCHEDULED);
            t.setEstadoRevision(EstadoRevision.NO_APLICA);
        }
        TorneroBuilder id(Long id) { t.setId(id); return this; }
        TorneroBuilder slug(String s) { t.setSlug(s); return this; }
        TorneroBuilder nombre(String n) { t.setNombre(n); return this; }
        TorneroBuilder estado(EstadoTorneo e) { t.setEstado(e); return this; }
        TorneroBuilder revision(EstadoRevision r) { t.setEstadoRevision(r); return this; }
        TorneroBuilder creador(Usuario u) { t.setCreadoPor(u); return this; }
        TorneroBuilder publico(boolean b) { t.setPublico(b); return this; }
        Torneo build() { return t; }
    }

    private static void stubSave(TorneoRepository repo) {
        lenient().when(repo.save(any(Torneo.class))).thenAnswer(inv -> {
            Torneo t = inv.getArgument(0);
            if (t.getId() == null || t.getId() == 0) t.setId(99L);
            return t;
        });
        lenient().when(repo.saveAndFlush(any(Torneo.class))).thenAnswer(inv -> {
            Torneo t = inv.getArgument(0);
            if (t.getId() == null || t.getId() == 0) t.setId(99L);
            return t;
        });
    }

    private static List<Long> list(Long... vals) { return java.util.Arrays.asList(vals); }

    // ─── crear ───────────────────────────────────────────────────────────────

    @Nested
    class Crear {

        @Test
        void creaPublicoConNombreYDescripcion() {
            var req = new TorneoCrearRequest("Naruto Best Girl", "Who is the best?");
            when(torneoRepository.existsBySlug("naruto-best-girl")).thenReturn(false);
            stubSave(torneoRepository);

            Torneo result = service.crear(req);

            assertThat(result.getNombre()).isEqualTo("Naruto Best Girl");
            assertThat(result.getDescripcion()).isEqualTo("Who is the best?");
            assertThat(result.isPublico()).isTrue();
            verify(torneoRepository).saveAndFlush(any(Torneo.class));
        }

        @Test
        void serializaAntesDeElegirSlug() {
            var req = new TorneoCrearRequest("Slug Race", null);
            when(torneoRepository.existsBySlug("slug-race")).thenReturn(false);
            stubSave(torneoRepository);

            service.crear(req);

            var orden = org.mockito.Mockito.inOrder(torneoCreationLock, torneoRepository);
            orden.verify(torneoCreationLock).bloquearCreacionTorneos();
            orden.verify(torneoRepository).existsBySlug("slug-race");
            orden.verify(torneoRepository).saveAndFlush(any(Torneo.class));
        }
    }

    // ─── crearPorUsuario ───────────────────────────────────────────────────

    @Nested
    class CrearPorUsuario {

        @Test
        void lanzaCuandoUsuarioNull() {
            var req = makeCrearMioRequest("Test", list(1L,2L,3L,4L,5L,6L,7L,8L));

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> service.crearPorUsuario(null, req));

            assertThat(ex.getMessage()).isEqualTo("Se requiere usuario autenticado");
        }

        @Test
        void lanzaCuandoUsuarioNoVerificado() {
            Usuario u = makeUsuario(1L, "unverified", EstadoVerificacion.PENDIENTE);
            var req = makeCrearMioRequest("Test", list(1L,2L,3L,4L,5L,6L,7L,8L));

            assertThrows(org.springframework.web.server.ResponseStatusException.class,
                    () -> service.crearPorUsuario(u, req));
        }

        @Test
        void lanzaCuandoTamanioInvalido() {
            Usuario u = makeUsuario(1L, "verified", EstadoVerificacion.ACTIVO);
            lenient().when(torneoRepository.existsBySlug(any())).thenReturn(false);
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> {
                Torneo r = inv.<Torneo>getArgument(0); r.setId(99L); return r;
            });

            assertThrows(IllegalArgumentException.class,
                    () -> service.crearPorUsuario(u, makeCrearMioRequest("T", list(1L,2L,3L,4L,5L,6L,7L))));
        }

        @Test
        void lanzaCuandoHayDuplicados() {
            Usuario u = makeUsuario(1L, "verified", EstadoVerificacion.ACTIVO);
            var req = makeCrearMioRequest("T", list(1L,2L,3L,4L,5L,6L,7L,1L)); // 1L twice

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> service.crearPorUsuario(u, req));

            assertThat(ex.getMessage()).contains("duplicados");
        }

        @Test
        void lanzaCuandoPersonajeNoExiste() {
            Usuario u = makeUsuario(1L, "verified", EstadoVerificacion.ACTIVO);
            for (long i = 1; i <= 7; i++) lenient().when(personajeRepository.findById(i)).thenReturn(Optional.of(personaje(i).build()));
            lenient().when(personajeRepository.findById(8L)).thenReturn(Optional.empty());
            lenient().when(torneoRepository.existsBySlug(any())).thenReturn(false);
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> {
                Torneo r = inv.<Torneo>getArgument(0); r.setId(99L); return r;
            });
            lenient().when(torneoRepository.saveAndFlush(any(Torneo.class))).thenAnswer(inv -> {
                Torneo r = inv.<Torneo>getArgument(0); r.setId(99L); return r;
            });

            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class,
                    () -> service.crearPorUsuario(u, makeCrearMioRequest("T", list(1L,2L,3L,4L,5L,6L,7L,8L))));

            assertThat(ex.getMessage()).contains("Personaje no encontrado: id=8");
        }

        @Test
        void creaCon8ParticipantesYBracket() {
            Usuario u = makeUsuario(1L, "verified", EstadoVerificacion.ACTIVO);
            for (long i = 1; i <= 8; i++) lenient().when(personajeRepository.findById(i)).thenReturn(Optional.of(personaje(i).build()));
            when(torneoRepository.existsBySlug(any())).thenReturn(false);
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> {
                Torneo r = inv.<Torneo>getArgument(0); r.setId(99L); return r;
            });
            lenient().when(torneoRepository.saveAndFlush(any(Torneo.class))).thenAnswer(inv -> {
                Torneo r = inv.<Torneo>getArgument(0); r.setId(99L); return r;
            });

            var req = new TorneoCrearMioRequest("Test 8", "Desc",
                    list(1L,2L,3L,4L,5L,6L,7L,8L), null);
            var result = service.crearPorUsuario(u, req);

            assertThat(result.getCreadoPor()).isEqualTo(u);
            assertThat(result.getEstadoRevision()).isEqualTo(EstadoRevision.PENDIENTE);
            assertThat(result.getEstado()).isEqualTo(EstadoTorneo.SCHEDULED);
            verify(torneoCreationLock).bloquearCreacionTorneos();
            verify(bracketService).crearBracket(any(Torneo.class), any());
        }
    }

    private static TorneoCrearMioRequest makeCrearMioRequest(String nombre, List<Long> ids) {
        return new TorneoCrearMioRequest(nombre, null, ids, null);
    }

    // ─── aprobar / rechazar ──────────────────────────────────────────────────

    @Nested
    class Aprobar {

        @Test
        void lanzaCuandoTorneoNoExiste() {
            when(torneoRepository.findById(99L)).thenReturn(Optional.empty());

            assertThrows(EntityNotFoundException.class, () -> service.aprobar(99L));
        }

        @Test
        void lanzaCuandoEstadoNoEsPendiente() {
            var t = torneo().id(1L).revision(EstadoRevision.APROBADO).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            stubSave(torneoRepository);

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> service.aprobar(1L));

            assertThat(ex.getMessage()).contains("PENDIENTE");
        }

        @Test
        void apruebaYCambiaAInProgress() {
            var t = torneo().id(1L).revision(EstadoRevision.PENDIENTE)
                    .nombre("Pending Test").slug("pending-test").build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));
            // notificacionService.crear() and indexNowService are best-effort (caught internally)

            var result = service.aprobar(1L);

            assertThat(result.getEstado()).isEqualTo(EstadoTorneo.IN_PROGRESS);
            assertThat(result.getEstadoRevision()).isEqualTo(EstadoRevision.APROBADO);
            assertThat(result.getFechaInicio()).isNotNull();
            verify(indexNowService).notificarUna("/torneos/pending-test");
            verify(notificacionService).notificarTorneoDisponibleATodos(any(Torneo.class));
        }
    }

    @Nested
    class Rechazar {

        @Test
        void lanzaCuandoMotivoVacio() {
            var t = torneo().id(1L).revision(EstadoRevision.PENDIENTE).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            stubSave(torneoRepository);

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> service.rechazar(1L, "   "));

            assertThat(ex.getMessage()).contains("motivo");
        }

        @Test
        void rechazaConMotivo() {
            var u = makeUsuario(5L, "creator", EstadoVerificacion.ACTIVO);
            var t = torneo().id(1L).revision(EstadoRevision.PENDIENTE)
                    .nombre("Reject Me").creador(u).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));

            var result = service.rechazar(1L, "Contenido inapropiado");

            assertThat(result.getEstadoRevision()).isEqualTo(EstadoRevision.RECHAZADO);
            assertThat(result.getMotivoRechazo()).isEqualTo("Contenido inapropiado");
            assertThat(result.getFechaRevisado()).isNotNull();
        }
    }

    // ─── iniciar ────────────────────────────────────────────────────────────

    @Nested
    class Iniciar {

        @Test
        void lanzaCuandoTorneoNoExiste() {
            when(torneoRepository.findById(99L)).thenReturn(Optional.empty());

            assertThrows(EntityNotFoundException.class, () -> service.iniciar(99L, null));
        }

        @Test
        void lanzaCuandoEstadoNoScheduled() {
            var t = torneo().id(1L).estado(EstadoTorneo.IN_PROGRESS).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> service.iniciar(1L, null));

            assertThat(ex.getMessage()).contains("SCHEDULED");
        }

        @Test
        void iniciaSinParticipantes() {
            var t = torneo().id(1L).estado(EstadoTorneo.SCHEDULED).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));

            var result = service.iniciar(1L, null);

            assertThat(result.getEstado()).isEqualTo(EstadoTorneo.IN_PROGRESS);
            assertThat(result.getFechaInicio()).isNotNull();
            verify(bracketService, org.mockito.Mockito.never()).crearBracket(any(), any());
            verify(notificacionService).notificarTorneoDisponibleATodos(any(Torneo.class));
        }

        @Test
        void iniciaAunqueFanOutPushFalle() {
            var t = torneo().id(1L).estado(EstadoTorneo.SCHEDULED).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));
            doThrow(new RuntimeException("push caido"))
                    .when(notificacionService).notificarTorneoDisponibleATodos(any(Torneo.class));

            var result = service.iniciar(1L, null);

            assertThat(result.getEstado()).isEqualTo(EstadoTorneo.IN_PROGRESS);
        }

        @Test
        void iniciaConBracket() {
            var t = torneo().id(1L).estado(EstadoTorneo.SCHEDULED).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));
            for (long i = 1; i <= 4; i++) lenient().when(personajeRepository.findById(i)).thenReturn(Optional.of(personaje(i).build()));

            var request = new TorneoIniciarRequest(list(1L, 2L, 3L, 4L));
            service.iniciar(1L, request);

            verify(bracketService).crearBracket(any(Torneo.class), any());
        }

        @Test
        void lanzaCuandoNoEsPotenciaDe2() {
            var t = torneo().id(1L).estado(EstadoTorneo.SCHEDULED).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));
            for (long i = 1; i <= 6; i++) lenient().when(personajeRepository.findById(i)).thenReturn(Optional.of(personaje(i).build()));

            var request = new TorneoIniciarRequest(list(1L, 2L, 3L, 4L, 5L, 6L)); // 6 not power of 2

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> service.iniciar(1L, request));

            assertThat(ex.getMessage()).contains("potencia de 2");
        }

        @Test
        void lanzaCuandoDuplicados() {
            var t = torneo().id(1L).estado(EstadoTorneo.SCHEDULED).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));

            var request = new TorneoIniciarRequest(list(1L, 2L, 1L, 4L)); // 1L duplicated

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> service.iniciar(1L, request));

            assertThat(ex.getMessage()).contains("duplicados");
        }
    }

    // ─── crearEnfrentamientos ───────────────────────────────────────────────

    @Nested
    class CrearEnfrentamientos {

        @Test
        void lanzaCuandoTorneoFinished() {
            var t = torneo().id(1L).estado(EstadoTorneo.FINISHED).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> service.crearEnfrentamientos(1L, List.of()));

            assertThat(ex.getMessage()).contains("FINISHED");
        }

        @Test
        void lanzaCuandoMismoPersonaje() {
            var t = torneo().id(1L).estado(EstadoTorneo.IN_PROGRESS).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(personajeRepository.findById(5L)).thenReturn(Optional.of(personaje(5L).build()));

            var req = makeEnfrentamientoRequest(5L, 5L); // same

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> service.crearEnfrentamientos(1L, List.of(req)));

            assertThat(ex.getMessage()).contains("sí mismo");
        }

        @Test
        void lanzaCuandoPersonajeNoExiste() {
            var t = torneo().id(1L).estado(EstadoTorneo.IN_PROGRESS).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            lenient().when(personajeRepository.findById(7L)).thenReturn(Optional.empty());

            var req = makeEnfrentamientoRequest(7L, 8L);

            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class,
                    () -> service.crearEnfrentamientos(1L, List.of(req)));

            assertThat(ex.getMessage()).contains("Personaje no encontrado: id=7");
        }

        @Test
        void creaUnEnfrentamiento() {
            var t = torneo().id(1L).estado(EstadoTorneo.IN_PROGRESS).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            Personaje p1 = personaje(1L).build();
            Personaje p2 = personaje(2L).build();
            lenient().when(personajeRepository.findById(1L)).thenReturn(Optional.of(p1));
            lenient().when(personajeRepository.findById(2L)).thenReturn(Optional.of(p2));
            lenient().when(enfrentamientoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            var req = makeEnfrentamientoRequest(1L, 2L);
            var result = service.crearEnfrentamientos(1L, List.of(req));

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getPersonaje1()).isEqualTo(p1);
            assertThat(result.get(0).getPersonaje2()).isEqualTo(p2);
        }
    }

    private static com.diegoalegil.animeshowdown.dto.EnfrentamientoCrearRequest makeEnfrentamientoRequest(Long p1Id, Long p2Id) {
        return new com.diegoalegil.animeshowdown.dto.EnfrentamientoCrearRequest(p1Id, p2Id);
    }

    // ─── generarSlugUnico ───────────────────────────────────────────────────

    @Nested
    class GenerarSlugUnico {

        @Test
        void retornaBaseCuandoNoExiste() {
            when(torneoRepository.existsBySlug("test-name")).thenReturn(false);

            String result = service.generarSlugUnico("Test Name");

            assertThat(result).isEqualTo("test-name");
        }

        @Test
        void anadeSufijo2CuandoBaseExiste() {
            when(torneoRepository.existsBySlug("test-name")).thenReturn(true);
            when(torneoRepository.existsBySlug("test-name-2")).thenReturn(false);

            String result = service.generarSlugUnico("Test Name");

            assertThat(result).isEqualTo("test-name-2");
        }

        @Test
        void incrementaHastaEncontrarLibre() {
            when(torneoRepository.existsBySlug("test-name")).thenReturn(true);
            when(torneoRepository.existsBySlug("test-name-2")).thenReturn(true);
            when(torneoRepository.existsBySlug("test-name-3")).thenReturn(true);
            when(torneoRepository.existsBySlug("test-name-4")).thenReturn(false);

            String result = service.generarSlugUnico("Test Name");

            assertThat(result).isEqualTo("test-name-4");
        }
    }

    // ─── finalizar ──────────────────────────────────────────────────────────

    @Nested
    class Finalizar {

        @Test
        void lanzaCuandoNoInProgress() {
            var t = torneo().id(1L).estado(EstadoTorneo.SCHEDULED).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> service.finalizar(1L));

            assertThat(ex.getMessage()).contains("IN_PROGRESS");
        }

        @Test
        void lanzaCuandoBracketNoSeCierra() {
            var t = torneo().id(1L).estado(EstadoTorneo.IN_PROGRESS).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            when(bracketAdvanceService.cerrarTodasLasRondas(t))
                    .thenReturn(BracketAdvanceService.Resultado.SIN_CAMBIOS);

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> service.finalizar(1L));

            assertThat(ex.getMessage()).contains("matches sin votos");
        }

        @Test
        void finalizaYyResuelvePredicciones() {
            var t = torneo().id(1L).estado(EstadoTorneo.IN_PROGRESS).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            when(bracketAdvanceService.cerrarTodasLasRondas(t))
                    .thenReturn(BracketAdvanceService.Resultado.TORNEO_FINALIZADO);
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));
            when(prediccionService.resolverParaTorneo(any(Torneo.class))).thenReturn(7);

            service.finalizar(1L);

            verify(prediccionService).resolverParaTorneo(any(Torneo.class));
            verify(notificacionService).notificarTorneoFinalizadoATodos(any(Torneo.class));
        }

        @Test
        void finalizaManualReparteRecompensasDeEvento() {
            // A8: el finalize manual debe repartir las recompensas de copa de
            // evento igual que el auto-avance; antes se las saltaba.
            var t = torneo().id(1L).estado(EstadoTorneo.IN_PROGRESS).build();
            when(torneoRepository.findById(1L)).thenReturn(Optional.of(t));
            when(bracketAdvanceService.cerrarTodasLasRondas(t))
                    .thenReturn(BracketAdvanceService.Resultado.TORNEO_FINALIZADO);
            lenient().when(torneoRepository.save(any(Torneo.class))).thenAnswer(inv -> inv.getArgument(0));
            when(prediccionService.resolverParaTorneo(any(Torneo.class))).thenReturn(0);

            service.finalizar(1L);

            verify(eventoRecompensaService).repartirPorTorneoFinalizado(any(Torneo.class));
        }
    }

    // ─── listar ──────────────────────────────────────────────────────────────

    @Nested
    class ListarTorneos {

        @Test
        void listarDelUsuarioDevuelveVacioSiNull() {
            assertThat(service.listarTorneosDelUsuario(null)).isEmpty();
        }

        @Test
        void listarPendientesDelegaAlRepo() {
            var t = torneo().id(5L).build();
            when(torneoRepository.findByEstadoRevisionOrderByFechaCreacionAsc(EstadoRevision.PENDIENTE))
                    .thenReturn(List.of(t));

            var result = service.listarPendientesRevision();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(5L);
        }
    }
}
