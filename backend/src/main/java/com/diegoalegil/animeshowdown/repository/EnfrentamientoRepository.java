package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.Enfrentamiento;
import com.diegoalegil.animeshowdown.model.Torneo;

public interface EnfrentamientoRepository extends JpaRepository<Enfrentamiento, Long> {

    List<Enfrentamiento> findByTorneo(Torneo torneo);
}
