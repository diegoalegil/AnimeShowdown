package com.diegoalegil.animeshowdown.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.diegoalegil.animeshowdown.model.Logro;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.model.UsuarioLogro;

public interface UsuarioLogroRepository extends JpaRepository<UsuarioLogro, Long> {

    List<UsuarioLogro> findByUsuarioOrderByDesbloqueadoEnDesc(Usuario usuario);

    /**
     * Logros desbloqueados de un usuario con JOIN FETCH de logro.
     * Versión optimizada para perfil público — evita N+1 ([R3-9]).
     */
    @Query("""
            select ul from UsuarioLogro ul
            join fetch ul.logro
            where ul.usuario = :usuario
            order by ul.desbloqueadoEn desc
            """)
    List<UsuarioLogro> findByUsuarioWithLogro(@Param("usuario") Usuario usuario);

    /** Check rápido sin cargar la fila — usado por BadgeService antes de intentar insertar. */
    boolean existsByUsuarioAndLogro(Usuario usuario, Logro logro);

    @Query("""
            select count(ul) > 0
            from UsuarioLogro ul
            where ul.usuario = :usuario
              and ul.logro.codigo = :codigo
            """)
    boolean existsByUsuarioAndLogroCodigo(@Param("usuario") Usuario usuario, @Param("codigo") String codigo);

    long countByUsuario(Usuario usuario);

    /**
     * Counts agregados por badge para la página pública /logros: cuántos
     * usuarios han desbloqueado cada uno (proxy de rareza real, complementa
     * la rareza nominal del catálogo).
     *
     * <p>Devuelve {@code [logroId, count]} para los logros con al menos 1
     * desbloqueo. Los logros con 0 desbloqueos NO aparecen — el caller debe
     * defaultear a 0 si no encuentra la entry.
     */
    @Query("select ul.logro.id, count(ul) from UsuarioLogro ul group by ul.logro.id")
    List<Object[]> contarDesbloqueosPorLogro();
}
