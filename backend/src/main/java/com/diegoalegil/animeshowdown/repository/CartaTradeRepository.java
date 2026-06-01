package com.diegoalegil.animeshowdown.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.CartaTrade;
import com.diegoalegil.animeshowdown.model.CartaTradeEstado;
import com.diegoalegil.animeshowdown.model.Usuario;

import jakarta.persistence.LockModeType;

public interface CartaTradeRepository extends JpaRepository<CartaTrade, Long> {

    @EntityGraph(attributePaths = {
            "solicitante",
            "destinatario",
            "cartaOfrecida",
            "cartaOfrecida.personaje",
            "cartaSolicitada",
            "cartaSolicitada.personaje"
    })
    @Query("""
            SELECT t
            FROM CartaTrade t
            WHERE t.solicitante = :usuario OR t.destinatario = :usuario
            ORDER BY t.creadoEn DESC, t.id DESC
            """)
    List<CartaTrade> findByParticipante(@Param("usuario") Usuario usuario);

    Optional<CartaTrade> findBySolicitanteAndIdempotencyKey(Usuario solicitante, String idempotencyKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "solicitante",
            "destinatario",
            "cartaOfrecida",
            "cartaOfrecida.personaje",
            "cartaSolicitada",
            "cartaSolicitada.personaje"
    })
    @Query("SELECT t FROM CartaTrade t WHERE t.id = :id")
    Optional<CartaTrade> findForUpdateById(@Param("id") Long id);

    long countByEstadoAndDestinatario(CartaTradeEstado estado, Usuario destinatario);
}
