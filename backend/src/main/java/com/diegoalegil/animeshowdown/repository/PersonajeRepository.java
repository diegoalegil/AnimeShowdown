package com.diegoalegil.animeshowdown.repository;

import com.diegoalegil.animeshowdown.model.Personaje;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PersonajeRepository extends JpaRepository<Personaje, Long> {

    List<Personaje> findByAnime(String anime);
}