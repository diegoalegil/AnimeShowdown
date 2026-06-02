package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.model.DueloLive;
import com.diegoalegil.animeshowdown.model.DueloLiveChoice;
import com.diegoalegil.animeshowdown.model.DueloLiveRonda;
import com.diegoalegil.animeshowdown.model.DueloLiveRondaEstado;
import com.diegoalegil.animeshowdown.model.FantasyEquipo;
import com.diegoalegil.animeshowdown.model.FantasyEquipoItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.DueloLiveRepository;
import com.diegoalegil.animeshowdown.repository.DueloLiveRondaRepository;
import com.diegoalegil.animeshowdown.repository.FantasyEquipoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

/**
 * Tests para el fix de R3-5: DataSeeder.borrarPersonajeConCascada no revienta
 * con FK constraint violation por duelos_live_rondas.
 *
 * <p>El fix anade dueloLiveRondaRepository.deleteByPersonajeId(p.getId())
 * antes de personajeRepository.delete(p) — limpia las FK RESTRICT
 * (personaje_a_id, personaje_b_id) en duelos_live_rondas.
 *
 * <p>Aislamiento del test: NO usa deleteAll global. Cada test crea sus
 * entidades con slug/username unicos (uuid). Limpia en orden hijo→padre
 * (rondas → duelos → personajes) para respetar las FK y no romper el suite.
 */
@SpringBootTest
@ActiveProfiles("test")
class DataSeederCascadaDuelosLiveTest {

    @Autowired private DataSeeder dataSeeder;
    @Autowired private PersonajeRepository personajeRepo;
    @Autowired private DueloLiveRepository dueloRepo;
    @Autowired private DueloLiveRondaRepository rondaRepo;
    @Autowired private FantasyEquipoRepository fantasyEquipoRepo;
    @Autowired private UsuarioRepository usuarioRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    private String unique;

    @BeforeEach
    void preSetUp() {
        unique = UUID.randomUUID().toString();
    }

    /**
     * Fail-before/pass-after del bug: un Personaje referenciado en una
     * DueloLiveRonda (como personajeA) no puede borrarse si la FK
     * RESTRICT no esta limpia.
     *
     * ANTES del fix: personajeRepository.delete(p) lanza
     * DataIntegrityViolationException (FK constraint violation).
     * DESPUES: borrarPersonajeConCascadaPublic(p) completa sin excepcion,
     * y el personaje + la ronda quedan borrados.
     */
    @Test
    void personajeConRondaLiveSeBorraEnCascada() {
        // Crear personaje + dos usuarios para el duelo.
        Personaje p1 = crearPersonaje("char1_" + unique);
        Personaje p2 = crearPersonaje("char2_" + unique);
        Usuario j1 = crearUsuario("j1_" + unique);
        Usuario j2 = crearUsuario("j2_" + unique);

        // Crear DueloLive con una ronda que referencia p1 (personajeA).
        DueloLive duelo = new DueloLive(j1, "127.0.0.1", LocalDateTime.now());
        duelo = dueloRepo.save(duelo);

        DueloLiveRonda ronda = new DueloLiveRonda(duelo, 1, p1, p2,
                LocalDateTime.now().minusMinutes(5),
                LocalDateTime.now().plusMinutes(5));
        ronda.setEstado(DueloLiveRondaEstado.IN_PROGRESS);
        rondaRepo.saveAndFlush(ronda);

        Long personajeId = p1.getId();

        // ANTES del fix: esto lanza DataIntegrityViolationException por la
        // FK RESTRICT en duelos_live_rondas.personaje_a_id.
        // DESPUES: completa sin excepcion.
        assertThatNoException().isThrownBy(
                () -> dataSeeder.borrarPersonajeConCascadaPublic(p1));

        // Verificar que personaje y ronda fueron borrados.
        assertThat(personajeRepo.findById(personajeId)).isEmpty();
        assertThat(rondaRepo.findById(ronda.getId())).isEmpty();
        // El duelo sigue (puede existir sin jugadores — depende del soft-delete
        // de usuarios, no es relevante para este test).
        assertThat(dueloRepo.findById(duelo.getId())).isPresent();
    }

    /**
     * Verifica que el mismo personaje referenciado como personajeB
     * (no solo como personajeA) también se borra correctamente.
     */
    @Test
    void personajeComoPersonajeBEnRondaSeBorraEnCascada() {
        Personaje p1 = crearPersonaje("char3_" + unique);
        Personaje p2 = crearPersonaje("char4_" + unique);
        Usuario j1 = crearUsuario("j3_" + unique);
        Usuario j2 = crearUsuario("j4_" + unique);

        DueloLive duelo = new DueloLive(j1, "127.0.0.1", LocalDateTime.now());
        duelo = dueloRepo.save(duelo);

        DueloLiveRonda ronda = new DueloLiveRonda(duelo, 1, p1, p2,
                LocalDateTime.now().minusMinutes(5),
                LocalDateTime.now().plusMinutes(5));
        ronda.setEstado(DueloLiveRondaEstado.IN_PROGRESS);
        rondaRepo.saveAndFlush(ronda);

        Long personajeId = p2.getId();

        assertThatNoException().isThrownBy(
                () -> dataSeeder.borrarPersonajeConCascadaPublic(p2));

        assertThat(personajeRepo.findById(personajeId)).isEmpty();
        assertThat(rondaRepo.findById(ronda.getId())).isEmpty();
    }

    @Test
    void personajeEnEquipoFantasySeLimpiaAntesDeBorrar() {
        Personaje personaje = crearPersonaje("fantasy_char_" + unique);
        Usuario usuario = crearUsuario("fantasy_" + unique);
        FantasyEquipo equipo = new FantasyEquipo(usuario, "2026W22");
        equipo.reemplazarItems(List.of(new FantasyEquipoItem(personaje, 42)));
        equipo = fantasyEquipoRepo.saveAndFlush(equipo);

        Long personajeId = personaje.getId();
        Long equipoId = equipo.getId();

        assertThatNoException().isThrownBy(
                () -> dataSeeder.borrarPersonajeConCascadaPublic(personaje));

        assertThat(personajeRepo.findById(personajeId)).isEmpty();
        assertThat(fantasyEquipoRepo.findById(equipoId)).isPresent();
        assertThat(contarFantasyItems(personajeId)).isZero();
    }

    @Test
    void fkFantasyItemPersonajeTieneCascadeEnBaseDeDatos() {
        Personaje personaje = crearPersonaje("fantasy_fk_" + unique);
        Usuario usuario = crearUsuario("fantasy_fk_" + unique);
        FantasyEquipo equipo = new FantasyEquipo(usuario, "2026W23");
        equipo.reemplazarItems(List.of(new FantasyEquipoItem(personaje, 10)));
        fantasyEquipoRepo.saveAndFlush(equipo);

        Long personajeId = personaje.getId();

        assertThat(contarFantasyItems(personajeId)).isOne();
        jdbcTemplate.update("DELETE FROM personajes WHERE id = ?", personajeId);

        assertThat(contarFantasyItems(personajeId)).isZero();
        assertThat(personajeRepo.findById(personajeId)).isEmpty();
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private Personaje crearPersonaje(String slug) {
        Personaje p = new Personaje();
        p.setSlug(slug);
        p.setNombre("Test " + slug);
        p.setAnime("Test Anime");
        p.setDescripcion("Test character");
        p.setImagenUrl("https://example.com/img.png");
        return personajeRepo.save(p);
    }

    private Usuario crearUsuario(String username) {
        Usuario u = new Usuario(username, "{noop}secreta123",
                username.replace("_", "") + "@test.com");
        u.setEloPvp(1000);
        return usuarioRepo.save(u);
    }

    private long contarFantasyItems(Long personajeId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fantasy_equipo_item WHERE personaje_id = ?",
                Long.class,
                personajeId);
    }
}
