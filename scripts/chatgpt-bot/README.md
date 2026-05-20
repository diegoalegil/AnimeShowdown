# ChatGPT Batch Image Generator

Browser-automation con Playwright para generar imágenes en serie a través
de ChatGPT Pro web. **Lee primero la sección de riesgo.**

## ⚠️ Riesgo de ban

Esto **viola los TOS de OpenAI** (sección 2(a)(iii) prohíbe "automated
or programmatic method to extract output"). OpenAI detecta browser
automation y puede banear la cuenta Pro entera (incluido billing y
API keys). El script aplica defensas anti-detección pero **no las
elimina**.

**Recomendaciones:**

- Empieza con los 3-4 primeros prompts y observa el comportamiento
  antes de tirar las 30 seguidas.
- No corras esto a la vez que estás usando ChatGPT en otra pestaña.
- Si OpenAI te muestra captcha, el script pausa y te avisa — resuélvelo
  a mano y reanudará.
- Si te banean, no hay recurso. Los $200/mes del Pro están en juego.

Alternativas seguras: OpenAI API (~$6-26 para 150 imágenes, mismo
motor), Replicate Flux (~$0.50), ComfyUI local (gratis).

## Setup

```bash
cd scripts/chatgpt-bot
npm install
npm run install:browser  # baja Chromium (~150MB), una vez
```

## Uso

### Primera ejecución

```bash
npm start
```

Lo que pasa:
1. Abre Chromium con un `user-data/` persistente (queda en este folder)
2. Te lleva a `chatgpt.com/auth/login` — **inicia sesión a mano**
3. Cuando estés en la interfaz de chat (puedes escribir), vuelve a la
   terminal y pulsa **ENTER**
4. El script empieza a iterar `prompts.json`:
   - Abre nuevo chat
   - Tipea el prompt (carácter a carácter, no paste)
   - Envía
   - Espera respuesta (detectado por estado del UI)
   - Descarga la imagen a `downloads/<slug>.png`
   - Espera 8-20s
   - Siguiente

### Reanudar tras corte

Si se cae, pulsas Ctrl+C, o aparece un captcha que no resuelves:

```bash
npm run resume
```

Lee `state.json` y retoma desde el último prompt no hecho.

### Editar la lista de prompts

`prompts.json` contiene un array `prompts` con objetos
`{ slug, category, prompt }`. Edítalo libremente:

- Añadir/quitar prompts
- Reordenar (afecta orden de ejecución)
- Cambiar el `slug` cambia el nombre del PNG resultante

Si rerun con cambios sin `--resume`, vuelve a generar desde cero.

## Defensas anti-detección implementadas

| Defensa | Por qué |
|---|---|
| Browser **headed** (no headless) | Headless es detectable por > 30 heurísticos |
| `userDataDir` persistente | Cookies, localStorage, fingerprint estables entre runs |
| `viewport: null` | Ventana redimensionable libre por el usuario (no tamaño fijo) |
| `--start-maximized` | Arranca maximizada pero ajustable |
| Tipeo carácter a carácter con delay 25-65ms | Humanos no pegan instantáneo |
| Delay random 8-20s entre prompts | Cadencia no robótica |
| Pausa larga 3-5min cada 15 prompts | Simula "respiración" humana |
| Detección de imagen DIRECTAMENTE en DOM | No por botón Stop (errático en GPT-5), poll del `<img>` con `complete && naturalWidth>0` |
| Prefijo `"Generate this image:"` | Fuerza image gen en GPT-5 Auto (sin ese prefijo a veces busca en web) |
| `context.request.get()` para download | Server-side desde Playwright con cookies, más robusto que `page.evaluate(fetch)` |
| Auto-retry ×2 por prompt | Reintenta antes de saltar definitivamente |
| Screenshot en `errors/<slug>-<ts>.png` | Diagnóstico cuando falla |
| `disable-blink-features=AutomationControlled` | Quita el flag `navigator.webdriver` |
| Captcha guard | Pausa al detectar Cloudflare/captcha challenge |
| Dialog dismisser | Cierra popups "Got it / Aceptar / Entendido" automáticamente |
| Detección de rechazo de ChatGPT | "I can't help with that" → saltar prompt, no esperar 4min |
| State.json — `lastIndex` solo avanza con éxito | Resilencia ante cortes |

## Procesamiento tras descargar

Las imágenes caen en `scripts/chatgpt-bot/downloads/<slug>.png` con el
slug correcto. Para integrarlas en la web:

```bash
# Mueve todas las PNGs descargadas al tmp del frontend
mv scripts/chatgpt-bot/downloads/*.png frontend/img/tmp/

# Y avísame en Claude — proceso con el pipeline existente:
# 1. cwebp -q 88 → WebP por cada PNG
# 2. Move a frontend/public/assets/<carpeta>/ según category
# 3. node scripts/sync-visual-assets.mjs (regenera manifest)
# 4. Commit + push
```

## Limitaciones

- **Selectores del DOM** de chatgpt.com cambian a veces. Si el script
  falla con timeouts repetidos, revisa `SELECTORS` en `run.mjs` y
  actualiza con los selectores actuales (Inspect en el browser).
- **gpt-image-1** (el modelo de imagen) puede rechazar prompts con
  ciertas palabras clave (nombres de personajes con copyright agresivo).
  Si un prompt falla 3 veces seguidas, edita su redacción.
- **Rate limit**: ChatGPT Pro tiene generación ilimitada en teoría pero
  hay throttling soft. Si notas que las imágenes tardan más de 2min,
  baja el batch a 10-15 por sesión y espera unas horas.
