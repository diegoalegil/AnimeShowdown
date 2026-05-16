package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;

public interface UsuarioLogroRepository extends JpaRepository<UsuarioLogro, Long> {

    /** Logros desbloqueados de un usuario, ordenados por fecha desc (más reciente primero). */
    List<UsuarioLogro> findByUsuarioOrderByDesbloqueadoEnDesc(Usuario usuario);

    /** Check rápido sin cargar la fila — usado por BadgeService antes de intentar insertar. */
    boolean existsByUsuarioAndLogro(Usuario usuario, Logro logro);

    long countByUsuario(Usuario usuario);
}
