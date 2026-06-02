package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import com.diegoalegil.animeshowdown.dto.CartaDto;
import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioCarta;
import com.diegoalegil.animeshowdown.repository.CartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioCartaRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
class CartaDestacadaServiceTest {

    @Autowired private CartaDestacadaService service;
    @Autowired private UsuarioRepository usuarioRepo;
    @Autowired private UsuarioCartaRepository usuarioCartaRepo;
    @Autowired private CartaRepository cartaRepo;

    private Usuario crearUsuario(String base) {
        String username = base + "_" + System.nanoTime();
        Usuario u = new Usuario(username, "{noop}secreta123", username + "@test.com");
        u.setEloPvp(1000);
        return usuarioRepo.save(u);
    }

    private List<Carta> tresCartas() {
        // El catálogo de cartas se siembra en el contexto de test (1086).
        return cartaRepo.findAll(PageRequest.of(0, 3)).getContent();
    }

    private UsuarioCarta poseer(Usuario u, Carta c) {
        return usuarioCartaRepo.save(new UsuarioCarta(u, c));
    }

    @Test
    void destacarCartaPoseidaLaMarca() {
        Usuario u = crearUsuario("dest_ok");
        Carta carta = tresCartas().get(0);
        poseer(u, carta);

        CartaDto dto = service.destacar(u, carta.getId());

        assertThat(dto.id()).isEqualTo(carta.getId());
        assertThat(service.obtenerDestacada(u)).get()
                .extracting(CartaDto::id).isEqualTo(carta.getId());
    }

    @Test
    void destacarOtraReemplazaLaAnterior() {
        Usuario u = crearUsuario("dest_swap");
        List<Carta> cartas = tresCartas();
        poseer(u, cartas.get(0));
        poseer(u, cartas.get(1));

        service.destacar(u, cartas.get(0).getId());
        service.destacar(u, cartas.get(1).getId());

        // Solo la segunda queda destacada (set-once).
        assertThat(service.obtenerDestacada(u)).get()
                .extracting(CartaDto::id).isEqualTo(cartas.get(1).getId());
        long destacadas = usuarioCartaRepo.findByUsuarioOrderByObtenidaEnDesc(u).stream()
                .filter(UsuarioCarta::isDestacada).count();
        assertThat(destacadas).isEqualTo(1);
    }

    @Test
    void quitarDejaElPerfilSinDestacada() {
        Usuario u = crearUsuario("dest_quitar");
        Carta carta = tresCartas().get(0);
        poseer(u, carta);
        service.destacar(u, carta.getId());

        service.quitar(u);

        assertThat(service.obtenerDestacada(u)).isEmpty();
    }

    @Test
    void noSePuedeDestacarUnaCartaNoPoseida() {
        Usuario u = crearUsuario("dest_ajena");
        Carta noPoseida = tresCartas().get(2);

        assertThatThrownBy(() -> service.destacar(u, noPoseida.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }
}
