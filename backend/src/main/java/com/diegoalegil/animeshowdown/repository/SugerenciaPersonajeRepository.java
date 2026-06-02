package com.diegoalegil.animeshowdown.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.SugerenciaEstado;
import com.diegoalegil.animeshowdown.model.SugerenciaPersonaje;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface SugerenciaPersonajeRepository extends JpaRepository<SugerenciaPersonaje, Long> {

    /** Historial del proponente (más recientes primero). */
    Page<SugerenciaPersonaje> findByUsuarioOrderByCreadoEnDesc(Usuario usuario, Pageable pageable);

    /** Cola admin por estado (FIFO: las más antiguas primero). */
    Page<SugerenciaPersonaje> findByEstadoOrderByCreadoEnAsc(SugerenciaEstado estado, Pageable pageable);
}
