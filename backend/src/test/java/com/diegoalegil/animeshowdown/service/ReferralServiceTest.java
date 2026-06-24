package com.diegoalegil.animeshowdown.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.UsuarioRepository;

class ReferralServiceTest {

    private UsuarioRepository usuarioRepository;
    private ReferralService sut;

    @BeforeEach
    void setUp() {
        usuarioRepository = mock(UsuarioRepository.class);
        sut = new ReferralService(usuarioRepository);
    }

    @Test
    void guardarTolerandoColision_caminoFeliz_guardaUnaVez() {
        Usuario u = new Usuario("alice", "pw", "alice@example.com");
        u.setReferralCode("ABCD2345");
        when(usuarioRepository.save(u)).thenReturn(u);

        Usuario out = sut.guardarTolerandoColisionReferral(u);

        assertThat(out).isSameAs(u);
        assertThat(u.getReferralCode()).isEqualTo("ABCD2345");
        verify(usuarioRepository, times(1)).save(u);
    }

    @Test
    void guardarTolerandoColision_colisionDeReferralCode_degradaSinCodigoYReSalva() {
        Usuario u = new Usuario("bob", "pw", "bob@example.com");
        u.setReferralCode("WXYZ6789");
        // Primer save colisiona en el UNIQUE del referral_code; el segundo (ya
        // sin código) entra limpio.
        when(usuarioRepository.save(u))
                .thenThrow(new DataIntegrityViolationException("uk_referral_code"))
                .thenReturn(u);

        Usuario out = sut.guardarTolerandoColisionReferral(u);

        assertThat(out).isSameAs(u);
        assertThat(u.getReferralCode()).isNull(); // degradado: el backfill lo asignará
        verify(usuarioRepository, times(2)).save(u);
    }

    @Test
    void guardarTolerandoColision_colisionDeOtroConstraint_propaga() {
        // Sin código referral, una DIV no puede venir del referral_code → debe
        // propagarse intacta (p.ej. choque de username/email), no enmascararse.
        Usuario u = new Usuario("carol", "pw", "carol@example.com");
        u.setReferralCode(null);
        when(usuarioRepository.save(u))
                .thenThrow(new DataIntegrityViolationException("uk_username"));

        assertThatThrownBy(() -> sut.guardarTolerandoColisionReferral(u))
                .isInstanceOf(DataIntegrityViolationException.class);
        verify(usuarioRepository, times(1)).save(u);
        verify(usuarioRepository, times(1)).save(any(Usuario.class));
    }
}
