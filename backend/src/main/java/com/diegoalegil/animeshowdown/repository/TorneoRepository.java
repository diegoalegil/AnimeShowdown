package com.diegoalegil.animeshowdown.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.Torneo;

public interface TorneoRepository extends JpaRepository<Torneo, Long> {

}
