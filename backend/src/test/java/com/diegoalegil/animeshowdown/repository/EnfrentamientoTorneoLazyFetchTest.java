package com.diegoalegil.animeshowdown.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;

import org.hibernate.LazyInitializationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.Torneo;

/**
 * Blinda el cambio EAGER->LAZY de las @ManyToOne de Enfrentamiento y Torneo
 * (con open-in-view=false). Los accesos FUERA de tx (DTO de /siguiente, imagen
 * OG del torneo) solo son seguros porque sus queries hacen JOIN FETCH. Este
 * test pina ese contrato: cargar por la query CON fetch + tocar la asociación
 * con la sesión cerrada NO lanza; cargar por la query SIN fetch SÍ lanza
 * (prueba que las asociaciones son LAZY de verdad y que el JOIN FETCH es lo
 * único que las salva).
 */
@SpringBootTest
@ActiveProfiles("test")
class EnfrentamientoTorneoLazyFetchTest {

    @Autowired private EnfrentamientoRepository enfrentamientoRepository;
    @Autowired private TorneoRepository torneoRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private PlatformTransactionManager txManager;

    private static String uniq(String t) {
        return t + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private Personaje nuevoPersonaje(String tag) {
        String s = uniq(tag);
        return personajeRepository.save(
                new Personaje(s, s, "Anime " + s, "fixture", "/img/qa/" + s + ".webp"));
    }

    @Test
    void findByIdInFetchHidrataLasAsociacionesLazyDeEnfrentamiento() {
        Personaje p1 = nuevoPersonaje("enf_p1");
        Personaje p2 = nuevoPersonaje("enf_p2");
        Torneo torneo = torneoRepository.save(new Torneo(uniq("enf_t"), "Lazy Enf", "fixture"));
        Long enfId = enfrentamientoRepository.save(new Enfrentamiento(torneo, p1, p2)).getId();
        TransactionTemplate tx = new TransactionTemplate(txManager);

        // findByIdInFetch (JOIN FETCH personaje1/2/ganador/torneo): seguro fuera de tx.
        Enfrentamiento conFetch = tx.execute(s ->
                enfrentamientoRepository.findByIdInFetch(List.of(enfId)).get(0));
        assertThat(conFetch.getPersonaje1().getNombre()).isNotNull();
        assertThat(conFetch.getTorneo().getNombre()).isNotNull();

        // Control: findById SIN fetch -> proxy lazy -> revienta con la sesión cerrada.
        Enfrentamiento sinFetch = tx.execute(s -> enfrentamientoRepository.findById(enfId).orElseThrow());
        assertThatThrownBy(() -> sinFetch.getPersonaje1().getNombre())
                .isInstanceOf(LazyInitializationException.class);
    }

    @Test
    void findBySlugFetchGanadorHidrataElGanadorLazyDeTorneo() {
        Personaje ganador = nuevoPersonaje("torneo_g");
        String slug = uniq("torneo_lazy");
        Torneo t = new Torneo(slug, "Lazy Torneo", "fixture");
        t.setGanadorPersonaje(ganador);
        torneoRepository.save(t);
        TransactionTemplate tx = new TransactionTemplate(txManager);

        // findBySlugFetchGanador (JOIN FETCH ganadorPersonaje): seguro fuera de tx.
        Torneo conFetch = tx.execute(s -> torneoRepository.findBySlugFetchGanador(slug).orElseThrow());
        assertThat(conFetch.getGanadorPersonaje().getImagenUrl()).isNotNull();

        // Control: findBySlug SIN fetch -> proxy lazy -> revienta con la sesión cerrada.
        Torneo sinFetch = tx.execute(s -> torneoRepository.findBySlug(slug).orElseThrow());
        assertThatThrownBy(() -> sinFetch.getGanadorPersonaje().getImagenUrl())
                .isInstanceOf(LazyInitializationException.class);
    }
}
