package com.diegoalegil.animeshowdown.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class VotoUsuarioFechaIndexTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void votosTieneIndiceCompuestoParaHistorialDeUsuario() throws Exception {
        List<String> columnas = jdbcTemplate.queryForList("""
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.INDEX_COLUMNS
                WHERE UPPER(TABLE_NAME) = 'VOTOS'
                  AND UPPER(INDEX_NAME) = 'IDX_VOTOS_USUARIO_FECHA'
                ORDER BY ORDINAL_POSITION
                """, String.class).stream()
                .map(column -> column.toUpperCase(java.util.Locale.ROOT))
                .toList();

        assertThat(columnas).containsExactly("USUARIO_ID", "FECHA");
    }
}
