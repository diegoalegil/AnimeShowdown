package com.diegoalegil.animeshowdown.config;

import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;

/**
 * Metadatos públicos de la API expuesta por springdoc-openapi.
 *
 * Lo accesible en /v3/api-docs y /swagger-ui.html:
 *   - Lista todos los endpoints bajo /api/** con shape de request/response.
 *   - Botón "Authorize" en Swagger UI para meter un Bearer JWT y probar
 *     endpoints autenticados directamente desde el navegador.
 *   - Esquema JSON que se puede importar en clientes (Postman, Insomnia)
 *     o subir a SwaggerHub para el bloque público de developers (§11.4).
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI animeshowdownOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("AnimeShowdown API")
                        .description("""
                                Backend REST de AnimeShowdown: catálogo de personajes anime,
                                torneos de eliminación directa con bracket en vivo,
                                votos y rankings.

                                **Auth:** JWT corto en header `Authorization: Bearer <token>`
                                + refresh token httpOnly cookie automático.

                                **Rate limits:** 5 req/min + 50 req/h por IP en rutas
                                críticas de auth y voto.
                                """)
                        .version("v1")
                        .contact(new Contact()
                                .name("Diego Gil")
                                .email("diegogildam@gmail.com")
                                .url("https://animeshowdown.dev"))
                        .license(new License()
                                .name("MIT")
                                .url("https://opensource.org/licenses/MIT")))
                .addServersItem(new Server()
                        .url("https://api.animeshowdown.dev")
                        .description("Producción (Railway + Supabase)"))
                .addServersItem(new Server()
                        .url("http://localhost:8080")
                        .description("Local dev"))
                // Esquema Bearer JWT global. Cada endpoint autenticado puede
                // referenciarlo con @SecurityRequirement; el botón Authorize
                // de Swagger UI lo entiende y permite probar con un token real.
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT obtenido vía POST /api/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }

    /**
     * Grupo "public": un spec OpenAPI filtrado a la superficie de LECTURA pública
     * (catálogo, votos/ranking, torneos, enfrentamientos, eventos, logros, status,
     * perfiles y tier-lists públicas), excluyendo explícitamente admin, auth, me,
     * cron y los sub-endpoints autenticados. Se sirve en {@code /v3/api-docs/public}
     * SIN autenticación (ver {@code SecurityConfig}) para que terceros consuman el
     * contrato de la API pública; el spec COMPLETO y Swagger UI siguen detrás de
     * ROLE_ADMIN en producción. El spec es solo documentación: no cambia la
     * seguridad de ningún endpoint.
     */
    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder()
                .group("public")
                .pathsToMatch(
                        "/api/personajes/**",
                        "/api/votos/**",
                        "/api/torneos/**",
                        "/api/enfrentamientos/**",
                        "/api/eventos/**",
                        "/api/logros/**",
                        "/api/status",
                        "/api/tier-lists/public/**",
                        "/api/perfil/**",
                        "/api/seguidores/**")
                .pathsToExclude(
                        "/api/admin/**",
                        "/api/auth/**",
                        "/api/me/**",
                        "/api/cron/**",
                        "/api/personajes/*/favorito")
                .build();
    }
}
