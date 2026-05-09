# AnimeShowdown

API REST de torneos y ranking de popularidad de personajes anime, con autenticación JWT y persistencia en PostgreSQL.

> **Estado:** backend completo. Frontend premium previsto para julio-agosto.

---

## Stack

- **Java 21**
- **Spring Boot 3.5.14** (Web + Data JPA + Security + Validation)
- **PostgreSQL 17**
- **JWT** con `com.auth0:java-jwt 4.4.0`
- **BCrypt** para hashing de passwords
- **springdoc-openapi 2.8.5** (Swagger UI)
- **Maven** + wrapper (`./mvnw`)
- **JUnit 5** + MockMvc + H2 in-memory para tests
- **Jikan API v4** para importar personajes desde MyAnimeList

---

## Setup local

### Requisitos

- Java 21
- PostgreSQL 17 corriendo en `localhost:5432`
- Una BD llamada `animeshowdown_db` y un user `animeshowdown_user` con permisos:

```sql
CREATE DATABASE animeshowdown_db;
CREATE USER animeshowdown_user WITH PASSWORD 'animeshowdown_dev_2026';
GRANT ALL PRIVILEGES ON DATABASE animeshowdown_db TO animeshowdown_user;
```

### Arranque

```bash
cd backend
./mvnw spring-boot:run
```

Spring levanta en `http://localhost:8080`. Hibernate con `ddl-auto=update` crea/actualiza el esquema automáticamente al arrancar.

### Documentación interactiva

- OpenAPI JSON: http://localhost:8080/v3/api-docs
- Swagger UI: http://localhost:8080/swagger-ui/index.html

---

## Variables de configuración

`backend/src/main/resources/application.properties`:

| Propiedad | Valor por defecto (dev) | Notas |
|---|---|---|
| `spring.datasource.url` | `jdbc:postgresql://localhost:5432/animeshowdown_db` | |
| `spring.datasource.username` | `animeshowdown_user` | |
| `spring.datasource.password` | `animeshowdown_dev_2026` | **cambiar en producción** |
| `jwt.secret` | clave dev hardcodeada | **regenerar para producción** |
| `jwt.expiration` | `3600000` (1 h en ms) | |

En producción deben venir de variables de entorno o secret manager.

---

## Endpoints

### Públicos (sin auth)

| Método | Path | Qué hace |
|---|---|---|
| POST | `/api/auth/registro` | Crea usuario nuevo (BCrypt). 409 si username duplicado. |
| POST | `/api/auth/login` | Devuelve `{token: "..."}`. 401 en credenciales inválidas. |
| GET | `/api/personajes` | Lista todos. `?anime=Naruto` filtra. |
| GET | `/api/personajes/{id}` | Por id. 404 si no existe. |
| POST | `/api/personajes` | Crea personaje. (en sesiones futuras: solo ADMIN). |
| PUT | `/api/personajes/{id}` | Actualiza. (futuro: solo ADMIN). |
| DELETE | `/api/personajes/{id}` | Elimina. (futuro: solo ADMIN). |
| POST | `/api/personajes/batch` | Crea muchos. (futuro: solo ADMIN). |
| GET | `/api/votos/ranking` | Ranking agregado por COUNT de votos. |
| GET | `/api/torneos` | Lista todos los torneos. |
| POST | `/api/torneos` | Crea torneo (estado BORRADOR). |
| PUT | `/api/torneos/{id}/iniciar` | BORRADOR → ACTIVO. 409 si no es BORRADOR. |
| POST | `/api/torneos/{id}/enfrentamientos` | Crea enfrentamientos en lote. 409 si torneo FINALIZADO. |
| PUT | `/api/torneos/{id}/finalizar` | ACTIVO → FINALIZADO + calcula ganadores por COUNT. |

### Protegidos (requieren JWT)

Cabecera: `Authorization: Bearer {token}`

| Método | Path | Qué hace |
|---|---|---|
| POST | `/api/personajes/{id}/votar` | Voto general. 409 si el usuario ya votó ese personaje. |
| POST | `/api/enfrentamientos/{id}/votar` | Body `{personajeGanadorId}`. 400 si no pertenece al enfrentamiento. 409 si torneo no ACTIVO o ya votó. |

### Solo ADMIN (`hasRole("ADMIN")`)

| Método | Path | Qué hace |
|---|---|---|
| POST | `/api/admin/personajes/importar?cantidad=N` | Importa top N personajes desde Jikan API (límite ~10 páginas, respeta rate limit). |

---

## Flujo de auth de ejemplo

```bash
# 1. Registro
curl -X POST http://localhost:8080/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"username":"diego","password":"naruto123","email":"diego@example.com"}'
# → 201 Created con {id, username, email, rol:"USER"} (sin password)

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"diego","password":"naruto123"}' | jq -r .token)

# 3. Usar token para votar
curl -X POST http://localhost:8080/api/personajes/4/votar \
  -H "Authorization: Bearer $TOKEN"
# → 200 OK con el voto creado

# 4. Promover a ADMIN (manualmente en BD por ahora)
psql -U animeshowdown_user -d animeshowdown_db \
  -c "UPDATE usuarios SET rol = 'ADMIN' WHERE username = 'diego';"

# 5. Login de nuevo (el filtro lee el rol actual de BD)
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"diego","password":"naruto123"}' | jq -r .token)

# 6. Importar personajes desde Jikan
curl -X POST "http://localhost:8080/api/admin/personajes/importar?cantidad=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Modelo de datos

```
usuarios (id, username UNIQUE, password BCrypt, email UNIQUE, rol enum, fecha_registro)
personajes (id, nombre, anime, descripcion, imagen_url)
votos (id, fecha, personaje_id FK, usuario_id FK nullable, enfrentamiento_id FK nullable)
torneos (id, nombre, descripcion, estado enum BORRADOR/ACTIVO/FINALIZADO, fecha_creacion, fecha_inicio, fecha_finalizacion)
enfrentamientos (id, torneo_id FK, personaje1_id FK, personaje2_id FK, ganador_id FK nullable, fecha_creacion)
```

- Campos `nullable=true` en `votos.usuario_id` y `votos.enfrentamiento_id` permiten coexistir votos generales (sin auth, legacy) con votos modernos.

---

## Tests

```bash
cd backend
./mvnw test
```

Cobertura actual: 7 tests JUnit (1 contextLoads + 6 de `AuthControllerTest` con MockMvc + H2 in-memory).

---

## Notas y limitaciones conocidas

- **Jikan import**: el endpoint `/top/characters` no incluye los animes asociados, así que el campo `anime` queda como `"Desconocido"` para personajes importados. Mejora futura: segunda llamada a `/characters/{mal_id}/anime`.
- **Empate en torneo**: si dos personajes empatan en votos al finalizar, `ganador` queda `NULL`.
- **Endpoints CRUD de personaje y torneo**: por ahora son `permitAll`. Próxima iteración: restringir POST/PUT/DELETE a `ROLE_ADMIN`.
- **Despliegue**: el deploy en Railway está pendiente; requiere configurar `JWT_SECRET` y `DB_*` como variables de entorno y desactivar `show-sql`.

---

## Roadmap

- [ ] Restringir CRUD de personajes/torneos a `ROLE_ADMIN`
- [ ] Endpoint para promocionar usuarios a ADMIN (con autorización del propio ADMIN)
- [ ] Despliegue en Railway con BD gestionada
- [ ] Más tests (TorneoController, EnfrentamientoController, AdminController)
- [ ] Frontend premium (React + Tailwind + Framer Motion)

---

## Disclaimer

Este proyecto utiliza nombres, imágenes y descripciones de personajes de anime obtenidos de [Jikan API](https://jikan.moe/) (API no oficial de MyAnimeList). Todo el contenido de personajes pertenece a sus respectivos autores y casas productoras. Este software se distribuye únicamente con fines educativos y de aprendizaje, sin ánimo de lucro. Ver [`LICENSE`](LICENSE) (MIT) para los términos del código fuente del proyecto.

---

## Autor

Diego Gil — [@diegoalegil](https://github.com/diegoalegil) — diegogildam@gmail.com
