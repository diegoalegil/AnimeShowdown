# Postman Collection

Colección Postman v2.1 con todos los endpoints de AnimeShowdown listos para probar.

## Archivos

| Archivo | Qué es |
|---|---|
| `AnimeShowdown.postman_collection.json` | La colección con los 17 endpoints organizados en carpetas (Auth, Personajes, Votos, Torneos, Enfrentamientos, Admin, System) |
| `AnimeShowdown-local.postman_environment.json` | Environment con `BASE_URL=http://localhost:8080` |
| `AnimeShowdown-render.postman_environment.json` | Environment con `BASE_URL=https://animeshowdown.onrender.com` |

## Importar en Postman

1. Abre Postman → **Import** (botón arriba izquierda)
2. Arrastra los 3 archivos `.json` (o uno a uno con "Choose Files")
3. Postman los detecta como collection + 2 environments
4. Arriba a la derecha selecciona el environment activo: **"AnimeShowdown — Local"** o **"AnimeShowdown — Render (prod)"**

## Uso típico

1. **Auth → Registrar usuario** → te crea uno (`diego` / `naruto123`)
2. **Auth → Login** → al ejecutarse, un script de "Tests" guarda automáticamente el `token` en la variable `TOKEN` del environment
3. Cualquier endpoint protegido usa `Authorization: Bearer {{TOKEN}}` automáticamente (definido en la auth de la colección)
4. Si quieres probar endpoints **admin**, primero promueve tu usuario en la BD:
   ```sql
   UPDATE usuarios SET rol = 'ADMIN' WHERE username = 'diego';
   ```
   Y vuelve a hacer Login (el filtro lee el rol actual de la BD).

## Endpoints incluidos

```
Auth
  POST  /api/auth/registro
  POST  /api/auth/login        ← guarda token automáticamente

Personajes (público)
  GET   /api/personajes
  GET   /api/personajes?anime=X
  GET   /api/personajes/{id}

Votos
  GET   /api/votos/ranking     (público)
  POST  /api/personajes/{id}/votar  (auth)

Torneos
  GET   /api/torneos                                 (público)
  POST  /api/torneos                                 (admin)
  PUT   /api/torneos/{id}/iniciar                    (admin)
  POST  /api/torneos/{id}/enfrentamientos            (admin)
  PUT   /api/torneos/{id}/finalizar                  (admin)

Enfrentamientos
  POST  /api/enfrentamientos/{id}/votar              (auth)

Admin
  POST  /api/admin/personajes/importar?cantidad=N    (admin)

System
  GET   /actuator/health
  GET   /v3/api-docs
```
