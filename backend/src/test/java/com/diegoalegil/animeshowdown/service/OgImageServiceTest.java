package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

class OgImageServiceTest {

    private PersonajeRepository personajeRepository;
    private VotoRepository votoRepository;
    private com.diegoalegil.animeshowdown.repository.UsuarioRepository usuarioRepository;
    private com.diegoalegil.animeshowdown.repository.SeguidorRepository seguidorRepository;
    private OgImageService service;

    @BeforeEach
    void setUp() {
        personajeRepository = mock(PersonajeRepository.class);
        TorneoRepository torneoRepository = mock(TorneoRepository.class);
        votoRepository = mock(VotoRepository.class);
        usuarioRepository = mock(com.diegoalegil.animeshowdown.repository.UsuarioRepository.class);
        seguidorRepository = mock(com.diegoalegil.animeshowdown.repository.SeguidorRepository.class);
        service = new OgImageService(
                personajeRepository,
                torneoRepository,
                votoRepository,
                usuarioRepository,
                seguidorRepository,
                "https://animeshowdown.dev");
    }

    @Test
    void renderRankingDevuelvePngConFallbackDeCatalogo() {
        when(votoRepository.rankingAllTime(any(Pageable.class))).thenReturn(Page.empty());
        when(personajeRepository.findAllOrderBySlug()).thenReturn(List.of(personaje("naruto", "Naruto Uzumaki", "Naruto")));

        byte[] png = service.renderRanking();

        assertPng(png);
    }

    @Test
    void renderAnimeDevuelvePngParaSlugValido() {
        when(personajeRepository.findDistinctAnimes()).thenReturn(List.of("Naruto"));
        when(votoRepository.rankingPorAnime(eq("Naruto"), any(Pageable.class))).thenReturn(List.of());
        when(personajeRepository.findByAnime("Naruto")).thenReturn(List.of(personaje("sasuke", "Sasuke Uchiha", "Naruto")));

        byte[] png = service.renderAnime("Naruto");

        assertPng(png);
    }

    @Test
    void renderPvpDevuelvePng() {
        byte[] png = service.renderPvp();

        assertPng(png);
    }

    @Test
    void renderDueloDevuelvePngParaDosPersonajesValidos() {
        when(personajeRepository.findBySlug("naruto_uzumaki"))
                .thenReturn(Optional.of(personaje("naruto_uzumaki", "Naruto Uzumaki", "Naruto")));
        when(personajeRepository.findBySlug("monkey_d_luffy"))
                .thenReturn(Optional.of(personaje("monkey_d_luffy", "Monkey D. Luffy", "One Piece")));

        byte[] png = service.renderDuelo("naruto_uzumaki", "monkey_d_luffy");

        assertPng(png);
    }

    @Test
    void renderUsuarioInexistenteDevuelveNull() {
        when(usuarioRepository.findByUsername("ghost")).thenReturn(Optional.empty());
        assertThat(service.renderUsuario("ghost")).isNull();
    }

    @Test
    void renderUsuarioExistenteDevuelvePng() {
        com.diegoalegil.animeshowdown.model.Usuario u =
                new com.diegoalegil.animeshowdown.model.Usuario("kira", "x", "kira@example.com");
        when(usuarioRepository.findByUsername("kira")).thenReturn(Optional.of(u));
        when(seguidorRepository.countByIdSeguidoId(any())).thenReturn(7L);
        when(votoRepository.countByUsuario(any())).thenReturn(42L);
        assertPng(service.renderUsuario("kira"));
    }

    private static Personaje personaje(String slug, String nombre, String anime) {
        Personaje p = new Personaje();
        p.setSlug(slug);
        p.setNombre(nombre);
        p.setAnime(anime);
        return p;
    }

    private static void assertPng(byte[] bytes) {
        assertThat(bytes).isNotEmpty();
        assertThat(bytes[0]).isEqualTo((byte) 0x89);
        assertThat(bytes[1]).isEqualTo((byte) 0x50);
        assertThat(bytes[2]).isEqualTo((byte) 0x4E);
        assertThat(bytes[3]).isEqualTo((byte) 0x47);
    }
}
