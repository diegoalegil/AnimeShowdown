package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.dto.PushSubscribeRequest;
import com.diegoalegil.animeshowdown.model.ReaccionTargetType;
import com.diegoalegil.animeshowdown.model.ReaccionTipo;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PersonajeFavoritoRepository;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.PushSubscriptionRepository;
import com.diegoalegil.animeshowdown.repository.ReaccionRepository;
import com.diegoalegil.animeshowdown.repository.SeguidorRepository;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

@SpringBootTest
@ActiveProfiles("test")
class SocialIdempotencyConcurrencyTest {

    @Autowired private PersonajeFavoritoService favoritoService;
    @Autowired private SeguidorService seguidorService;
    @Autowired private PushSubscriptionService pushSubscriptionService;
    @Autowired private ReaccionService reaccionService;

    @Autowired private PersonajeFavoritoRepository favoritoRepository;
    @Autowired private SeguidorRepository seguidorRepository;
    @Autowired private PushSubscriptionRepository pushSubscriptionRepository;
    @Autowired private ReaccionRepository reaccionRepository;
    @Autowired private PersonajeRepository personajeRepository;
    @Autowired private UsuarioRepository usuarioRepository;

    @Test
    void favoritosConcurrentesCreanUnaSolaRelacion() throws Exception {
        Usuario usuario = usuario("social_fav");

        List<Boolean> resultados = ejecutarConcurrente(IntStream.range(0, 6)
                .mapToObj(i -> (Callable<Boolean>) () -> favoritoService.seguir(usuario, "luffy"))
                .toList());

        assertThat(resultados).containsOnly(true, false);
        assertThat(resultados.stream().filter(Boolean::booleanValue).count()).isEqualTo(1);
        assertThat(favoritoRepository.countByUsuario(usuario)).isEqualTo(1);
    }

    @Test
    void seguidoresConcurrentesCreanUnaSolaRelacion() throws Exception {
        Usuario seguidor = usuario("social_follow_a");
        Usuario seguido = usuario("social_follow_b");

        List<Boolean> resultados = ejecutarConcurrente(IntStream.range(0, 6)
                .mapToObj(i -> (Callable<Boolean>) () -> seguidorService.seguir(seguidor, seguido.getId()))
                .toList());

        assertThat(resultados).containsOnly(true, false);
        assertThat(resultados.stream().filter(Boolean::booleanValue).count()).isEqualTo(1);
        assertThat(seguidorRepository.countByIdSeguidorId(seguidor.getId())).isEqualTo(1);
        assertThat(seguidorRepository.countByIdSeguidoId(seguido.getId())).isEqualTo(1);
    }

    @Test
    void pushSubscribeConcurrenteConservaUnEndpoint() throws Exception {
        Usuario usuario = usuario("social_push");
        String endpoint = "https://push.example/sub/social-" + System.nanoTime();
        PushSubscribeRequest request = new PushSubscribeRequest(
                endpoint,
                new PushSubscribeRequest.Keys("key-social", "auth-social"));

        ejecutarConcurrente(IntStream.range(0, 6)
                .mapToObj(i -> (Callable<String>) () -> pushSubscriptionService
                        .subscribe(usuario, request)
                        .endpoint())
                .toList());

        long filas = pushSubscriptionRepository.findAll().stream()
                .filter(sub -> endpoint.equals(sub.getEndpoint()))
                .count();
        assertThat(filas).isEqualTo(1);
    }

    @Test
    void reaccionesConcurrentesNoDuplicanElParUsuarioTarget() throws Exception {
        Usuario usuario = usuario("social_react");
        Long targetId = personajeRepository.findBySlug("saitama").orElseThrow().getId();

        ejecutarConcurrente(List.of(
                () -> reaccionService.aplicar(usuario, ReaccionTargetType.PERSONAJE, targetId, ReaccionTipo.FIRE),
                () -> reaccionService.aplicar(usuario, ReaccionTargetType.PERSONAJE, targetId, ReaccionTipo.HEART)));

        assertThat(reaccionRepository.countByUsuarioAndTargetTypeAndTargetId(
                usuario, ReaccionTargetType.PERSONAJE, targetId))
                .isEqualTo(1);
    }

    private Usuario usuario(String base) {
        String suffix = Long.toString(System.nanoTime(), 36);
        return usuarioRepository.saveAndFlush(new Usuario(
                base + "_" + suffix,
                "{noop}secreta123",
                base + "_" + suffix + "@example.com"));
    }

    private static <T> List<T> ejecutarConcurrente(List<Callable<T>> acciones) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(acciones.size());
        CountDownLatch preparados = new CountDownLatch(acciones.size());
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        try {
            for (Callable<T> accion : acciones) {
                futures.add(pool.submit(() -> {
                    preparados.countDown();
                    if (!salida.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timeout esperando salida concurrente");
                    }
                    return accion.call();
                }));
            }

            assertThat(preparados.await(5, TimeUnit.SECONDS)).isTrue();
            salida.countDown();

            List<T> resultados = new ArrayList<>(acciones.size());
            for (Future<T> future : futures) {
                resultados.add(future.get(15, TimeUnit.SECONDS));
            }
            return resultados;
        } finally {
            pool.shutdownNow();
        }
    }
}
