package com.diegoalegil.animeshowdown.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Monedero;
import com.diegoalegil.animeshowdown.model.Usuario;

import jakarta.persistence.LockModeType;

public interface MonederoRepository extends JpaRepository<Monedero, Long> {

    Optional<Monedero> findByUsuario(Usuario usuario);

    Optional<Monedero> findByUsuarioId(Long usuarioId);

    /**
     * Lectura con lock para gastar saldo (abrir sobre): serializa aperturas
     * concurrentes del mismo usuario para que dos no lean el mismo saldo y lo
     * dejen negativo. El CHECK(saldo &gt;= 0) es la red final.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Monedero m where m.usuario.id = :usuarioId")
    Optional<Monedero> findForUpdateByUsuarioId(@Param("usuarioId") Long usuarioId);
}
