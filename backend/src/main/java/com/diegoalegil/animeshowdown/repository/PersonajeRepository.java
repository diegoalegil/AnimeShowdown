package com.diegoalegil.animeshowdown.repository;

import com.diegoalegil.animeshowdown.model.Personaje;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonajeRepository extends JpaRepository<Personaje, Long> {
}