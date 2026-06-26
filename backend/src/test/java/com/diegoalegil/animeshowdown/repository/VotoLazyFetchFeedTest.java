package com.diegoalegil.animeshowdown.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.LazyInitializationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.diegoalegil.animeshowdown.dto.VotoFeedItem;
import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.Voto;

/**
 * Blinda el cambio EAGER->LAZY de las @ManyToOne de Voto (con
 * open-in-view=false). El único acceso a esas asociaciones FUERA de transacción
 * es el feed público (VotoFeedItem), y solo es seguro porque
 * findRecentesParaFeed las LEFT JOIN FETCH. Este test fija ese contrato:
 *
 * <ol>
 *   <li>cargar por el feed query y mapear el DTO con la sesión YA cerrada NO
 *       lanza LazyInitializationException (las asociaciones vienen inicializadas).</li>
 *   <li>control: cargar el MISMO voto por findById (sin fetch) y tocar una
 *       asociación con la sesión cerrada SÍ lanza — prueba que las asociaciones
 *       son de verdad LAZY y que el JOIN FETCH del feed es lo único que lo salva.</li>
 * </ol>
 */
@SpringBootTest
@ActiveProfiles("test")
class VotoLazyFetchFeedTest {

    @Autowired private VotoRepository votoRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private EnfrentamientoRepository enfrentamientoRepository;
    @Autowired private TorneoRepository torneoRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PlatformTransactionManager txManager;

    private static String uniq(String tag) {
        return tag + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private Personaje nuevoPersonaje(String tag) {
        String s = uniq(tag);
        return personajeRepository.save(
                new Personaje(s, s, "Anime " + s, "fixture", "/img/qa/" + s + ".webp"));
    }

    /** Crea un voto de enfrentamiento con usuario, fechado en el futuro para que
     * sea el primero del feed (ORDER BY v.fecha DESC). Devuelve su id. */
    private Long crearVotoDeFeed() {
        Personaje ganador = nuevoPersonaje("lazy_g");
        Personaje rival = nuevoPersonaje("lazy_r");
        Torneo torneo = torneoRepository.save(new Torneo(uniq("lazyfeed"), "Lazy Feed", "fixture"));
        Enfrentamiento enf = enfrentamientoRepository.save(new Enfrentamiento(torneo, ganador, rival));
        Usuario user = usuarioRepository.save(new Usuario(uniq("lazyuser"), "x", uniq("l") + "@e.com"));
        Voto v = new Voto(ganador, user, enf);
        v.setFecha(LocalDateTime.now().plusYears(50));
        return votoRepository.save(v).getId();
    }

    @Test
    void elFeedMapeaFueraDeTransaccionSinLazyInit() {
        Long votoId = crearVotoDeFeed();
        TransactionTemplate tx = new TransactionTemplate(txManager);

        // Carga dentro de una tx que se cierra al volver, vía el feed query.
        Voto cargado = tx.execute(s -> votoRepository.findRecentesParaFeed(PageRequest.of(0, 50))
                .stream().filter(v -> v.getId().equals(votoId)).findFirst().orElseThrow());

        // Sesión YA cerrada: mapear el DTO toca getPersonaje()/getEnfrentamiento()
        // /getUsuario() (ahora LAZY). No debe lanzar — el JOIN FETCH las inicializó.
        VotoFeedItem item = VotoFeedItem.from(cargado);
        assertThat(item.ganador()).isNotNull();
        assertThat(item.ganador().nombre()).isNotNull();
        assertThat(item.rival()).isNotNull();
        assertThat(item.username()).isNotNull();
    }

    @Test
    void cargarSinFetchYTocarLaAsociacionFueraDeTxLanzaLazyInit() {
        Long votoId = crearVotoDeFeed();
        TransactionTemplate tx = new TransactionTemplate(txManager);

        // findById NO hace JOIN FETCH: las asociaciones quedan como proxies lazy.
        Voto cargado = tx.execute(s -> votoRepository.findById(votoId).orElseThrow());

        // Con la sesión cerrada, tocar una asociación lazy revienta — confirma que
        // el cambio a LAZY es real (no quedó EAGER) y que el feed solo sobrevive
        // por su JOIN FETCH.
        assertThatThrownBy(() -> cargado.getPersonaje().getNombre())
                .isInstanceOf(LazyInitializationException.class);
    }
}
