package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.UsuarioMarco;

public interface UsuarioMarcoRepository extends JpaRepository<UsuarioMarco, Long> {

    List<UsuarioMarco> findByUsuarioId(Long usuarioId);

    boolean existsByUsuarioIdAndMarcoId(Long usuarioId, String marcoId);
}
