package com.diegoalegil.animeshowdown.db;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.test.context.ActiveProfiles;

import com.diegoalegil.animeshowdown.support.PostgresIntegrationTestBase;

import jakarta.persistence.EntityManagerFactory;

@SpringBootTest
@ActiveProfiles("test")
class PostgresMigrationValidationTest extends PostgresIntegrationTestBase {

    private static final Pattern MIGRATION_VERSION = Pattern.compile("^V(\\d+)__.+\\.sql$");

    @Autowired private DataSource dataSource;
    @Autowired private EntityManagerFactory entityManagerFactory;
    @Autowired private Flyway flyway;

    @Test
    void aplicaTodasLasMigracionesYValidaJpaSobrePostgresReal() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).contains("PostgreSQL");
        }

        assertThat(entityManagerFactory.getMetamodel().getEntities()).isNotEmpty();
        assertThat(flyway.info().current()).isNotNull();
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo(ultimaMigracionVersion());
    }

    private String ultimaMigracionVersion() throws Exception {
        Resource[] migrations = new PathMatchingResourcePatternResolver()
                .getResources("classpath*:db/migration/V*.sql");
        int latest = 0;
        for (Resource migration : migrations) {
            String filename = migration.getFilename();
            if (filename == null) {
                continue;
            }
            Matcher matcher = MIGRATION_VERSION.matcher(filename);
            if (matcher.matches()) {
                latest = Math.max(latest, Integer.parseInt(matcher.group(1)));
            }
        }
        assertThat(latest).isPositive();
        return String.valueOf(latest);
    }
}
