package com.diegoalegil.animeshowdown.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.Carta;
import com.diegoalegil.animeshowdown.model.CartaShowcase;
import com.diegoalegil.animeshowdown.model.CartaShowcaseSlot;
import com.diegoalegil.animeshowdown.model.Usuario;

public interface CartaShowcaseRepository extends JpaRepository<CartaShowcase, Long> {

    @EntityGraph(attributePaths = {"usuario", "carta", "carta.personaje"})
    List<CartaShowcase> findByUsuarioOrderBySlotAsc(Usuario usuario);

    @EntityGraph(attributePaths = {"usuario", "carta", "carta.personaje"})
    List<CartaShowcase> findByUsuarioUsernameOrderBySlotAsc(String username);

    @EntityGraph(attributePaths = {"usuario", "carta", "carta.personaje"})
    List<CartaShowcase> findTop24BySlotInOrderByActualizadoEnDesc(Collection<CartaShowcaseSlot> slots);

    @EntityGraph(attributePaths = {"usuario", "carta", "carta.personaje"})
    Optional<CartaShowcase> findByUsuarioAndSlot(Usuario usuario, CartaShowcaseSlot slot);

    void deleteByUsuarioAndSlot(Usuario usuario, CartaShowcaseSlot slot);

    void deleteByUsuarioAndCarta(Usuario usuario, Carta carta);
}
