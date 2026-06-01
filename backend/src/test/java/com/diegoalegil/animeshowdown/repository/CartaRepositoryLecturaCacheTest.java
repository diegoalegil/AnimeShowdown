package com.diegoalegil.animeshowdown.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.CartaCatalogoItem;
import com.diegoalegil.animeshowdown.dto.UsuarioCartaPosesionItem;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.PersonajeVotoScore;
import com.diegoalegil.animeshowdown.model.RarezaCarta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;

@SpringBootTest
@ActiveProfiles("test")
class CartaRepositoryLecturaCacheTest {

    @Autowired private CartaRepository cartaRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private PersonajeVotoScoreRepository personajeVotoScoreRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private UsuarioCartaRepository usuarioCartaRepository;

    @Test
    void findCatalogoItemsProyectaCatalogoSinHidratarEntidades() {
        String tag = tag("catalogo");
        Personaje personaje = personaje(tag);
        personaje.setImagenColorDominante("#f5c542");
        personajeRepository.save(personaje);

        Carta carta = new Carta(personaje, RarezaCarta.ESPECIAL);
        carta.setEspecialCurada(true);
        carta.setVariante("gold");
        carta.setArteUrl("/cartas/" + tag + ".webp");
        cartaRepository.save(carta);

        CartaCatalogoItem item = cartaRepository.findCatalogoItems().stream()
                .filter(it -> carta.getId().equals(it.id()))
                .findFirst()
                .orElseThrow();

        assertThat(item.personajeId()).isEqualTo(personaje.getId());
        assertThat(item.personajeSlug()).isEqualTo(personaje.getSlug());
        assertThat(item.personajeNombre()).isEqualTo(personaje.getNombre());
        assertThat(item.anime()).isEqualTo(personaje.getAnime());
        assertThat(item.imagenUrl()).isEqualTo(personaje.getImagenUrl());
        assertThat(item.colorDominante()).isEqualTo("#f5c542");
        assertThat(item.rareza()).isEqualTo(RarezaCarta.ESPECIAL);
        assertThat(item.especialCurada()).isTrue();
        assertThat(item.variante()).isEqualTo("gold");
        assertThat(item.arteUrl()).isEqualTo("/cartas/" + tag + ".webp");
    }

    @Test
    void findPosesionesByUsuarioProyectaSoloCantidadPorCartaDelUsuario() {
        String tag = tag("posesion");
        Usuario usuario = usuarioRepository.save(new Usuario(tag, "{noop}secreta123", tag + "@example.com"));
        Usuario otroUsuario = usuarioRepository.save(new Usuario(
                tag + "_otro", "{noop}secreta123", tag + "_otro@example.com"));
        Carta cartaUsuario = cartaRepository.save(new Carta(
                personajeRepository.save(personaje(tag + "_p1")), RarezaCarta.SSR));
        Carta cartaOtro = cartaRepository.save(new Carta(
                personajeRepository.save(personaje(tag + "_p2")), RarezaCarta.SSR));

        UsuarioCarta propia = new UsuarioCarta(usuario, cartaUsuario);
        propia.setCantidad(3);
        usuarioCartaRepository.save(propia);
        usuarioCartaRepository.save(new UsuarioCarta(otroUsuario, cartaOtro));

        assertThat(usuarioCartaRepository.findPosesionesByUsuario(usuario))
                .extracting(UsuarioCartaPosesionItem::cartaId, UsuarioCartaPosesionItem::cantidad)
                .containsExactly(tuple(cartaUsuario.getId(), 3));
    }

    @Test
    void findAllScoresLeeContadorMaterializadoSinAgruparVotos() {
        String tag = tag("score");
        Personaje personaje = personajeRepository.save(personaje(tag));
        PersonajeVotoScore score = new PersonajeVotoScore(personaje.getId());
        score.setVotosScore(2.5d);
        personajeVotoScoreRepository.save(score);

        assertThat(personajeVotoScoreRepository.findAllScores())
                .extracting(row -> row[0], row -> row[1])
                .contains(tuple(personaje.getId(), 2.5d));
    }

    private static Personaje personaje(String tag) {
        return new Personaje(
                tag,
                "Carta QA " + tag,
                "QA Anime",
                "fixture",
                "/img/qa/" + tag + ".webp");
    }

    private static String tag(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
    }
}
