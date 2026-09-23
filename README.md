# AnimeShowdown

Galería de cartas de personajes de anime. Más de mil cartas para mirar, cinco
sobres al día para abrir y un álbum para completar. Es una web estática: no hay
cuentas ni servidor, y la colección de cada visitante se guarda en su propio
navegador.

## Cómo se juega

- La **galería** muestra todas las cartas, las tengas o no, agrupadas por serie.
  Se puede buscar por nombre o serie (atajo `/`) y filtrar por serie o por las
  especiales; los filtros quedan en la dirección, así que se pueden compartir.
- Cada carta tiene su **ficha**: `←` y `→` recorren las cartas en el orden de la
  galería, `Esc` vuelve a ella y, si el personaje tiene versión especial, la carta
  se puede girar para verla.
- Cada día (a medianoche, hora local) hay **5 sobres** de **5 cartas**. Las cuatro
  primeras son personajes al azar; la quinta tiene un 15 % de probabilidad de ser
  una **carta especial**. Las repetidas se acumulan.
- En **Sobres** se rasga el sobre y las cartas quedan boca abajo sobre la mesa:
  se voltean una a una (también con `Intro` o `Espacio`), todas a la vez con
  «Revelar todas» o se va directo al resumen con «Saltar». Las cartas se guardan
  en cuanto se abre el sobre, así que recargar a mitad no pierde ninguna.
- La **colección** es un álbum con una hoja por serie y otra para las especiales:
  cada carta tiene su hueco numerado, ocupado si la tienes y vacío si no. Las
  cartas conseguidas desde la última visita se pegan en su hueco la primera vez
  que se ven. Se puede ver una sola serie o solo las empezadas.
- La colección vive en el navegador. Desde el álbum se copia como un código para
  guardarla o llevarla a otro navegador; al pegar un código se puede combinar con
  la colección actual o sustituirla.

Las reglas están en `src/config.js`.

Las texturas de papel y los motivos tradicionales de los sobres (`public/washi.png`,
`public/seigaiha.png` y `public/asanoha.png`) se generan con
`node scripts/generate-washi.mjs` y `node scripts/generate-patrones.mjs`.

## Ejecutarlo en local

Necesitas Node 22 (ver `.nvmrc`).

```bash
npm install
npm run dev       # servidor de desarrollo
npm test          # tests
npm run lint
npm run build     # valida los datos, construye y genera las páginas en dist/
npm run preview   # sirve dist/
```

Para publicar bajo una subcarpeta, construye con `BASE_PATH=/<carpeta>/ npm run build`.
El despliegue a GitHub Pages lo hace `.github/workflows/deploy.yml` en cada push a
`main`; si existe `public/CNAME`, la web se sirve desde la raíz del dominio.

## Añadir un personaje

1. Añade una línea al final de `src/data/personajes.json` con el siguiente número
   `n` libre:

   ```json
   {"id":"frieren","n":1087,"nombre":"Frieren","anime":"Frieren: Beyond Journey's End","animeId":"frieren","img":"img/Frieren/frieren","color":"#8a9aa6","nativo":"フリーレン"}
   ```

   `anime` debe coincidir con el `titulo` de su entrada en `src/data/animes.json`
   (súmale uno a su `count`, o crea la entrada si la serie es nueva). `color` es el
   tono dominante de la ilustración, que se ve mientras carga. `nativo` (nombre en
   japonés) y `desc` (una frase) son opcionales.

2. Copia la ilustración, en proporción 2:3 y formato WebP, en tres tamaños:

   ```
   public/img/Frieren/frieren.webp       ~1024 px de ancho
   public/img/Frieren/frieren-600.webp     600 px
   public/img/Frieren/frieren-300.webp     300 px
   ```

3. Comprueba los datos:

   ```bash
   node scripts/check-data.mjs
   ```

   También se ejecuta al construir: si falta un archivo o un campo, el build falla.

Las cartas especiales viven en `src/data/especiales.json` y `public/img/especiales/`,
con los mismos tres tamaños. Basta con copiar la ilustración original y ejecutar
`node scripts/generate-especiales.mjs` (necesita `cwebp` y `dwebp`): crea las versiones
de 300 y 600 px y anota en los datos la ruta y el tono dominante.

## Derechos

AnimeShowdown es un proyecto de aficionados sin ánimo de lucro. Los personajes, sus
nombres y las series a las que pertenecen son propiedad de sus autores, estudios y
editoriales. Las ilustraciones de las cartas son obras derivadas creadas por fans y se
muestran solo con fines de exposición; si eres titular de derechos y quieres que se
retire alguna, abre un issue.

El código se publica bajo licencia MIT (ver `LICENSE`). La licencia no cubre las
ilustraciones ni los personajes.
