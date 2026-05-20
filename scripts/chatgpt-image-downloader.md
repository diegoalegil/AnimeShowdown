# ChatGPT Image Downloader (Bookmarklet)

Workflow para automatizar la descarga masiva de imágenes generadas en una
conversación de ChatGPT Pro web, con nombres correctos por slug, sin
salir del navegador y sin tocar la API.

## Cómo usarlo

### 1. Instalar el bookmarklet (una vez)

1. Crea un marcador nuevo en tu navegador (cualquier página vale como
   "URL" temporal, lo vamos a sobreescribir).
2. Edita el marcador → en el campo **URL** pega el código del bookmarklet
   que está al final de este archivo (la línea larga que empieza por
   `javascript:`). Asegúrate de pegarla **completa**, en UNA sola línea.
3. Ponle nombre **"ChatGPT Downloader"** o algo similar.
4. Arrastra el marcador a la barra de favoritos para acceso rápido.

### 2. Pedirle las imágenes a ChatGPT con guión

Cuando le pidas un lote a ChatGPT, **siempre numera y nombra las imágenes
explícitamente** en el primer mensaje del lote. Ejemplo:

> Genera las siguientes 8 imágenes, una por una, 16:9 cinematic anime.
> Mismo estilo dark premium tournament para todas.
>
> 1. `naruto.png` — Hidden ninja village at night, orange chakra glow…
> 2. `one-piece.png` — Open sea at dusk, pirate crew silhouettes…
> 3. `my-hero-academia.png` — Modern hero city, green and blue energy…
> 4. `demon-slayer.png` — Moonlit Japanese forest, mist, nichirin sword…
> 5. `jujutsu-kaisen.png` — Cursed urban night, violet ritual energy…
> 6. `attack-on-titan.png` — Stone walls, smoke, dramatic sunset…
> 7. `chainsaw-man.png` — Dark urban street, red neon, chaos…
> 8. `fullmetal-alchemist.png` — Alchemical circles, gold and copper…

ChatGPT genera las 8 en orden. Cuando termine:

### 3. Descargar todas con un click

1. Quédate en la pestaña de la conversación de ChatGPT
2. Click en el marcador **"ChatGPT Downloader"** en la barra
3. Se abre un panel flotante mostrando cada imagen detectada con su
   nombre propuesto (extraído del guión que le diste)
4. Revisa los nombres, edítalos si hace falta
5. Click "Descargar todas" → el navegador baja las N imágenes a la
   carpeta de descargas con sus nombres correctos

### 4. Procesar el lote

```bash
# Mueve todo de Descargas a tmp del repo
mv ~/Downloads/{naruto,one-piece,my-hero-academia,...}.png \
   ~/Desktop/Repos-Github/AnimeShowdown/frontend/img/tmp/

# Avísame en Claude y proceso (cwebp -q 88 → mueve → manifest → commit → push)
```

## Notas

- Si el guión no nombra las imágenes, el bookmarklet usa `chatgpt-N.png`
  (1, 2, 3…) y tú renombras a mano antes de mover a `tmp/`.
- Si ChatGPT genera la imagen pero todavía está en streaming/loading
  cuando lanzas el bookmarklet, espera a que cargue del todo antes de
  pulsar el botón.
- El bookmarklet no envía datos a ningún sitio: corre íntegramente en
  el contexto de chatgpt.com y solo dispara `<a download>` clicks contra
  los CDN de OpenAI que ya están autenticados en tu sesión.

## Limitaciones conocidas

- Si OpenAI cambia el DOM de chatgpt.com, el selector se rompe.
  Solución: actualizar `IMG_SELECTOR` en el script.
- Imágenes muy grandes (>5 MB) pueden fallar el primer click; pulsa
  "Descargar todas" otra vez.

---

## El bookmarklet

Copia esta línea ENTERA (sin saltos de línea) al campo URL del marcador:

```
javascript:(async()=>{const SCRIPT_URL='https://animeshowdown.dev/tools/chatgpt-downloader.js?v=1';const s=document.createElement('script');s.src=SCRIPT_URL+'&t='+Date.now();document.body.appendChild(s);})();
```

El bookmarklet carga el script real desde
`https://animeshowdown.dev/tools/chatgpt-downloader.js`. Mantenemos el
código en el repo (`frontend/public/tools/chatgpt-downloader.js`) y se
sirve junto al resto del static del dominio, así puedo iterar sin que
tengas que reinstalar el marcador.
