package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.zip.CRC32;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.diegoalegil.animeshowdown.dto.TopPersonajeItem;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.TierList;
import com.diegoalegil.animeshowdown.model.TierListItem;
import com.diegoalegil.animeshowdown.model.TierListTier;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TierListRepository;
import com.diegoalegil.animeshowdown.repository.TorneoRepository;
import com.diegoalegil.animeshowdown.repository.VotoRepository;

class OgImageServiceTest {

    private PersonajeRepository personajeRepository;
    private VotoRepository votoRepository;
    private com.diegoalegil.animeshowdown.repository.UsuarioRepository usuarioRepository;
    private com.diegoalegil.animeshowdown.repository.SeguidorRepository seguidorRepository;
    private TierListRepository tierListRepository;
    private OgImageService service;

    @BeforeEach
    void setUp() {
        personajeRepository = mock(PersonajeRepository.class);
        TorneoRepository torneoRepository = mock(TorneoRepository.class);
        votoRepository = mock(VotoRepository.class);
        usuarioRepository = mock(com.diegoalegil.animeshowdown.repository.UsuarioRepository.class);
        seguidorRepository = mock(com.diegoalegil.animeshowdown.repository.SeguidorRepository.class);
        tierListRepository = mock(TierListRepository.class);
        service = new OgImageService(
                personajeRepository,
                torneoRepository,
                votoRepository,
                usuarioRepository,
                seguidorRepository,
                tierListRepository,
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
    void renderHomeDevuelvePngConFallbackDeCatalogo() {
        when(votoRepository.rankingAllTime(any(Pageable.class))).thenReturn(Page.empty());
        when(personajeRepository.findAllOrderBySlug()).thenReturn(List.of(personaje("naruto", "Naruto Uzumaki", "Naruto")));

        byte[] png = service.renderHome();

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
    void renderTierListDevuelvePngSoloParaSlugPublico() {
        Usuario usuario = new Usuario("tier_owner", "x", "tier@example.com");
        usuario.setId(7L);
        TierList tierList = new TierList();
        tierList.setId(11L);
        tierList.setUsuario(usuario);
        tierList.setTitulo("Best Naruto");
        tierList.setPublico(true);
        Personaje naruto = personaje("naruto", "Naruto Uzumaki", "Naruto");
        naruto.setId(1L);
        tierList.getItems().add(new TierListItem(tierList, naruto, TierListTier.S, 0));
        when(tierListRepository.findBySlugAndPublicoTrue("best-naruto"))
                .thenReturn(Optional.of(tierList));

        assertPng(service.renderTierList("best-naruto"));
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

    @Test
    void renderUsuarioConBannerDevuelvePng() {
        com.diegoalegil.animeshowdown.model.Usuario u =
                new com.diegoalegil.animeshowdown.model.Usuario("aira", "x", "aira@example.com");
        u.setBannerUrl(pngDataUri());
        when(usuarioRepository.findByUsername("aira")).thenReturn(Optional.of(u));
        when(seguidorRepository.countByIdSeguidoId(any())).thenReturn(3L);
        when(votoRepository.countByUsuario(any())).thenReturn(9L);
        assertPng(service.renderUsuario("aira"));
    }

    @Test
    void renderUsuarioUsaFavoritoComoBannerCuandoNoHayBanner() {
        com.diegoalegil.animeshowdown.model.Usuario u =
                new com.diegoalegil.animeshowdown.model.Usuario("hina", "x", "hina@example.com");
        when(usuarioRepository.findByUsername("hina")).thenReturn(Optional.of(u));
        when(seguidorRepository.countByIdSeguidoId(any())).thenReturn(1L);
        when(votoRepository.countByUsuario(any())).thenReturn(4L);
        // Favorito con imagen data URI (sin red) → se dibuja como fondo.
        when(votoRepository.topPorUsuario(any(), any(Pageable.class)))
                .thenReturn(List.of(new TopPersonajeItem(
                        1L, "gojo", "Gojo Satoru", pngDataUri(), "Jujutsu Kaisen", 5L)));
        assertPng(service.renderUsuario("hina"));
    }

    /**
     * R3-SSRF (regresión): el render de OG NO debe hacer fetch server-side a
     * una URL interna. Un usuario fija su banner a http://127.0.0.1:PORT/...
     * y el endpoint OG público lo renderiza; antes del guard el backend
     * pegaba a ese destino (1+ hits → SSRF), ahora SsrfGuard lo bloquea
     * (0 hits) y el OG cae al fallback. Levantamos un servidor local que
     * cuenta peticiones para distinguir "bloqueado" de "intentado-y-falló".
     */
    @Test
    void renderUsuarioNoHaceFetchServerSideAUrlInterna() throws Exception {
        com.sun.net.httpserver.HttpServer server =
                com.sun.net.httpserver.HttpServer.create(
                        new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        java.util.concurrent.atomic.AtomicInteger hits = new java.util.concurrent.atomic.AtomicInteger();
        server.createContext("/", exchange -> {
            hits.incrementAndGet();
            byte[] body = "x".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            int port = server.getAddress().getPort();
            com.diegoalegil.animeshowdown.model.Usuario u =
                    new com.diegoalegil.animeshowdown.model.Usuario("victima", "x", "victima@example.com");
            u.setBannerUrl("http://127.0.0.1:" + port + "/evil.png"); // destino interno
            when(usuarioRepository.findByUsername("victima")).thenReturn(Optional.of(u));
            when(seguidorRepository.countByIdSeguidoId(any())).thenReturn(0L);
            when(votoRepository.countByUsuario(any())).thenReturn(0L);

            byte[] png = service.renderUsuario("victima");

            assertPng(png); // sigue devolviendo OG (fallback), sin filtrar nada
            assertThat(hits.get())
                    .as("renderUsuario NO debe hacer fetch server-side a 127.0.0.1 (SSRF)")
                    .isZero();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void decodificarImagenSeguraRechazaStreamsConDemasiadosBytes() throws Exception {
        byte[] bytes = new byte[OgImageService.REMOTE_IMAGE_MAX_BYTES + 1];

        assertThat(OgImageService.decodificarImagenSegura(bytes)).isNull();
    }

    @Test
    void decodificarImagenSeguraRechazaImagenesConDemasiadosPixeles() throws Exception {
        byte[] pngGrande = pngHeaderConDimensiones(2_100, 2_100);

        assertThat(OgImageService.decodificarImagenSegura(pngGrande)).isNull();
    }

    /** PNG válido mínimo embebido como data URI (sin tocar la red). */
    private static String pngDataUri() {
        try {
            BufferedImage img = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            return "data:image/png;base64,"
                    + Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static byte[] pngHeaderConDimensiones(int width, int height) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
        ByteArrayOutputStream ihdr = new ByteArrayOutputStream();
        ihdr.write(intBytes(width));
        ihdr.write(intBytes(height));
        ihdr.write(new byte[] {8, 2, 0, 0, 0});
        escribirChunk(out, "IHDR", ihdr.toByteArray());
        escribirChunk(out, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void escribirChunk(ByteArrayOutputStream out, String type, byte[] data) throws Exception {
        byte[] typeBytes = type.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        out.write(intBytes(data.length));
        out.write(typeBytes);
        out.write(data);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        out.write(intBytes((int) crc.getValue()));
    }

    private static byte[] intBytes(int value) {
        return new byte[] {
                (byte) (value >>> 24),
                (byte) (value >>> 16),
                (byte) (value >>> 8),
                (byte) value
        };
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
