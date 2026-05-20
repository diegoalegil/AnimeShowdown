#!/usr/bin/env node
/**
 * ChatGPT browser-automation batch generator (Playwright).
 *
 * Lee prompts.json, abre Chromium headed con un userDataDir persistente
 * (te logueas UNA vez la primera ejecucion y la sesion se reusa), y
 * itera por cada prompt: nuevo chat -> tipea -> envia -> espera la
 * <img> generada en el DOM -> descarga via Playwright request (cookies
 * de la sesion) -> guarda como <slug>.png -> wait random -> siguiente.
 *
 * RIESGO: viola los TOS de OpenAI (seccion 2(a)(iii) prohibe "automated
 * or programmatic method to extract output"). Cuenta Pro puede ser
 * baneada. Defensas anti-deteccion implementadas reducen pero NO
 * eliminan el riesgo.
 *
 * Iteraciones aprendidas en ejecucion real:
 *  - viewport=null: la ventana es libre de redimensionar.
 *  - No depender del boton "Stop generating" — aparece y desaparece
 *    erratico en ChatGPT 5 sin correlacion con cuando la imagen
 *    realmente termina.
 *  - Prefijo "Generate this image: " es CRITICO en GPT-5 Auto.
 *  - Descarga via context.request.get() en lugar de page.evaluate(fetch).
 *  - Auto-retry x2 antes de saltar un prompt definitivamente.
 *  - Screenshot en errors/ para diagnostico cuando falla.
 *  - lastIndex solo avanza con exito real.
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_FILE = join(__dirname, 'prompts.json')
const STATE_FILE = join(__dirname, 'state.json')
const USER_DATA_DIR = join(__dirname, 'user-data')
const DOWNLOADS_DIR = join(__dirname, 'downloads')
const ERRORS_DIR = join(__dirname, 'errors')

// Knobs anti-deteccion. NO subas estos sin necesidad.
const DELAY_BETWEEN_PROMPTS = [8000, 20000]
const TYPE_DELAY_PER_CHAR = [25, 65]
const LONG_PAUSE_EVERY = 15
const LONG_PAUSE_DURATION = [180000, 300000]
const RESPONSE_TIMEOUT_MS = 240000 // 4 min — ChatGPT 5 a veces tarda
const POST_GENERATION_WAIT = [2000, 5000]
const MAX_RETRIES_PER_PROMPT = 2
// Cuando ChatGPT responde "no puedo por copyright/policy", el user confirma
// que mandar "try again" varias veces en el MISMO chat termina funcionando.
const MAX_REJECTION_RETRIES = 4
const REJECTION_MESSAGES = [
  'Try again, generate the image please.',
  'Please try again, generate that image.',
  'Please try once more — generate the image.',
  'Try again, generate it as a fully original artwork in your own style.',
]

const SELECTORS = {
  promptTextarea: [
    '#prompt-textarea',
    'textarea[data-id]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="mensaje" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
  ].join(', '),
  challengeIframe:
    'iframe[src*="challenges.cloudflare.com"], iframe[title*="hCaptcha"], iframe[title*="reCAPTCHA"]',
}

const log = (...args) => {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}]`, ...args)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const randInt = (range) => {
  const [min, max] = range
  return min + Math.floor(Math.random() * (max - min))
}

function loadPrompts() {
  return JSON.parse(readFileSync(PROMPTS_FILE, 'utf8')).prompts
}

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { done: [], lastIndex: -1, startedAt: new Date().toISOString() }
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

async function detectChallenge(page) {
  try {
    const iframe = await page.$(SELECTORS.challengeIframe)
    if (iframe) return true
  } catch {
    /* ignore */
  }
  try {
    const txt = await page.content()
    if (/verify you are human|attention required|cloudflare/i.test(txt)) return true
  } catch {
    /* ignore */
  }
  return false
}

async function waitForChallenge(page) {
  if (!(await detectChallenge(page))) return
  log('⚠️  CAPTCHA / Cloudflare challenge detectado — resuelvelo a mano en el browser.')
  log('   El script reanuda automaticamente cuando el challenge desaparece.')
  while (await detectChallenge(page)) {
    await wait(3000)
  }
  log('✅ Challenge resuelto. Continuando.')
}

async function dismissDialogs(page) {
  // Cerrar popups de bienvenida, banners de cookies, modal de "what's new"
  // que ChatGPT a veces muestra al cargar el chat. Patrones comunes:
  //   - Botones con texto "OK", "Accept", "Got it", "Aceptar", "Entendido"
  //   - Botones con aria-label="Close" o icono X en modal/dialog
  try {
    const candidatos = await page.$$('button:visible')
    for (const btn of candidatos) {
      try {
        const txt = await btn.textContent()
        if (!txt) continue
        const t = txt.trim().toLowerCase()
        if (
          t === 'ok' ||
          t === 'accept' ||
          t === 'aceptar' ||
          t === 'got it' ||
          t === 'entendido' ||
          t === 'continue' ||
          t === 'continuar' ||
          t === 'okay' ||
          t === "let's go" ||
          t === 'okay, got it'
        ) {
          await btn.click({ timeout: 2000 })
          await wait(500)
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

async function startNewChat(page) {
  await page.goto('https://chatgpt.com/', {
    waitUntil: 'domcontentloaded',
  })
  await wait(randInt([1500, 3000]))
  await waitForChallenge(page)
  await dismissDialogs(page)
}

async function typeHumanLike(page, text) {
  const selector = SELECTORS.promptTextarea
  const el = await page.waitForSelector(selector, { timeout: 30000, state: 'visible' })
  await el.click()
  await wait(randInt([200, 600]))
  // Tipear caracter a caracter. Si el target es contenteditable (div),
  // page.keyboard.type ya escribe en el elemento con foco — funciona en
  // ambos: textarea legacy y contenteditable del composer moderno.
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: randInt(TYPE_DELAY_PER_CHAR) })
  }
  await wait(randInt([400, 900]))
}

async function sendPrompt(page) {
  // Enter es el envio. En ChatGPT moderno el shortcut esta SIEMPRE
  // habilitado para el composer principal. Si por algun motivo el
  // textarea NO esta focuseado (improbable tras typeHumanLike), Enter
  // no hace nada y el bucle de waitForResponse hara timeout sin imagen.
  await page.keyboard.press('Enter')
}

async function detectRechazo(page) {
  // ChatGPT a veces se niega a generar imagenes con texto tipo "I can't
  // help with that" o "I'm unable to generate that image". Devuelve true
  // si detectamos ese patron — saltar el prompt en lugar de esperar 3min.
  try {
    const txt = (await page.evaluate(() => document.body.innerText || '')).toLowerCase()
    const patrones = [
      "i can't help",
      "i can't generate",
      "i'm unable to",
      "i won't generate",
      "i'm not able to",
      'no puedo generar',
      'no puedo ayudar',
      'this content is not allowed',
      'against the content policy',
      'against our usage policies',
    ]
    return patrones.some((p) => txt.includes(p))
  } catch {
    return false
  }
}

async function findGeneratedImage(page) {
  // Devuelve { src, width, height, total } de la imagen generada mas
  // reciente, o null si todavia no esta. total = numero de imagenes
  // generadas encontradas (util para detectar el caso "2 imagenes A/B").
  //
  // Audit (ejecucion real 2026-05-20): el filtro por dominio era
  // demasiado estricto. ChatGPT 5 puede servir las imagenes generadas
  // desde:
  //   - oaiusercontent.com (canon viejo)
  //   - files.oaiusercontent.com
  //   - chatgpt.com/backend-api/files/...
  //   - sdmntpreusercontent (CDN nuevo de Sora/imagenes)
  //   - blob: URLs locales mientras la imagen se renderiza
  //   - <div style="background-image"> en lugar de <img>
  //
  // Nueva estrategia: filtrar por TAMAÑO Y posición (dentro del area del
  // chat, no sidebar/avatar) en lugar de por dominio. Cualquier <img>
  // grande dentro de un mensaje del assistant es la generada.
  return await page.evaluate(() => {
    // Heuristica de "dentro del chat": el assistant message vive bajo
    // [data-message-author-role="assistant"] o dentro de un main.
    const main = document.querySelector('main') || document.body

    // Recoger TODAS las <img> visibles del chat con tamaño razonable.
    const imgs = Array.from(main.querySelectorAll('img'))
      // Excluir avatares del sidebar y user
      .filter((i) => {
        const rect = i.getBoundingClientRect()
        return rect.width >= 200 && rect.height >= 200
      })
      // Excluir las que no se hayan cargado todavia
      .filter((i) => i.complete && i.naturalWidth > 0)
      // Excluir las pequeñas (avatares, thumbs de input)
      .filter((i) => i.naturalWidth >= 256)
      // Excluir si src es data: muy chico (placeholder svg)
      .filter((i) => !i.src.startsWith('data:image/svg'))
      // Excluir logos/iconos de cabecera con clase obvia
      .filter((i) => {
        const cls = (i.className || '') + ' ' + (i.alt || '').toLowerCase()
        return !/avatar|logo|icon|profile/i.test(cls)
      })

    if (imgs.length === 0) {
      // Fallback: buscar div con background-image: url(...) grande
      const divs = Array.from(main.querySelectorAll('div')).filter((d) => {
        const bg = window.getComputedStyle(d).backgroundImage || ''
        if (!/url\(["']?https?:\/\//.test(bg)) return false
        const rect = d.getBoundingClientRect()
        return rect.width >= 256 && rect.height >= 256
      })
      if (divs.length === 0) return null
      const last = divs[divs.length - 1]
      const m = (window.getComputedStyle(last).backgroundImage || '').match(/url\(["']?([^"')]+)/)
      if (!m) return null
      return {
        src: m[1],
        width: Math.round(last.getBoundingClientRect().width),
        height: Math.round(last.getBoundingClientRect().height),
        total: 1,
        viaBackground: true,
      }
    }

    const last = imgs[imgs.length - 1]
    return {
      src: last.src,
      width: last.naturalWidth,
      height: last.naturalHeight,
      total: imgs.length,
      viaBackground: false,
    }
  })
}

async function dumpImagesForDebug(page) {
  // Para diagnostico cuando findGeneratedImage devuelve null pero el
  // user ve la imagen en pantalla. Devuelve src + size de TODAS las
  // <img> >= 100x100 para poder ajustar selectores.
  return await page.evaluate(() => {
    const main = document.querySelector('main') || document.body
    return Array.from(main.querySelectorAll('img'))
      .filter((i) => i.naturalWidth >= 100 || i.width >= 100)
      .slice(-10) // ultimas 10
      .map((i) => ({
        src: (i.src || '').slice(0, 120),
        natural: `${i.naturalWidth}x${i.naturalHeight}`,
        rect: `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`,
        complete: i.complete,
        alt: (i.alt || '').slice(0, 40),
      }))
  })
}

async function waitForGeneratedImage(page) {
  // El timer se resetea tras un "try again" porque cada reintento es una
  // nueva generacion que merece sus propios 4min.
  let timerStart = Date.now()
  let lastLog = 0
  let lastRejectionCheck = 0
  let rejectionRetries = 0
  let lastTextSnapshot = ''
  while (Date.now() - timerStart < RESPONSE_TIMEOUT_MS) {
    const img = await findGeneratedImage(page)
    if (img) {
      // ChatGPT a veces genera 2 imagenes (A/B preference). Esperamos un
      // poco mas para que se complete la segunda si esta llegando, y
      // descargamos la mas reciente. No clickeamos "Prefer A/B" — el
      // boton no aporta nada al objetivo (solo guarda telemetria de
      // OpenAI) y ahorrarse el click reduce signal de bot.
      await wait(4000)
      const img2 = await findGeneratedImage(page)
      const final = img2 || img
      if (final.total >= 2) {
        log(`   🎴 ChatGPT genero ${final.total} variantes — descargando la mas reciente (${final.width}x${final.height})`)
      }
      if (final.viaBackground) {
        log('   🖼️  Imagen via background-image (no <img> tradicional)')
      }
      return final
    }
    // Detectar rechazo temprano. Lo chequeamos cada 15s tras los primeros
    // 15s (antes de eso, ChatGPT puede mostrar "Pensando…" sin texto).
    const elapsed = Math.round((Date.now() - timerStart) / 1000)
    if (elapsed >= 15 && elapsed - lastRejectionCheck >= 15) {
      lastRejectionCheck = elapsed
      if (await detectRechazo(page)) {
        if (rejectionRetries >= MAX_REJECTION_RETRIES) {
          log(`   ⛔ Rechazo persistente tras ${MAX_REJECTION_RETRIES} retries — abandonando`)
          return null
        }
        const msg = REJECTION_MESSAGES[rejectionRetries % REJECTION_MESSAGES.length]
        rejectionRetries++
        log(`   🔁 Rechazo detectado — try again ${rejectionRetries}/${MAX_REJECTION_RETRIES} en el mismo chat`)
        try {
          // Pequena pausa para no parecer bot inmediato tras leer "no"
          await wait(randInt([2000, 4500]))
          await typeHumanLike(page, msg)
          await sendPrompt(page)
          // Reset el timer y los chequeos — empieza nueva generacion
          timerStart = Date.now()
          lastLog = 0
          lastRejectionCheck = 0
          lastTextSnapshot = ''
          await wait(3000)
          continue
        } catch (e) {
          log(`   ⚠️  No pude reenviar try-again: ${e.message}`)
          return null
        }
      }
    }
    if (elapsed >= lastLog + 20) {
      log(`   ⏳ ${elapsed}s elapsed, esperando imagen…`)
      lastLog = elapsed
      // Log breve si el texto cambio mucho — ayuda a ver si esta "pensando"
      // o "buscando en web" etc. Solo en cada log de 20s, no spam.
      try {
        const t = (await page.evaluate(() => (document.body.innerText || '').slice(-300))).trim()
        if (t && t !== lastTextSnapshot) {
          lastTextSnapshot = t
        }
      } catch {
        /* ignore */
      }
    }
    await wait(2500)
  }
  log(`   ⌛ Timeout tras ${Math.round((Date.now() - timerStart) / 1000)}s sin imagen`)
  try {
    const debug = await dumpImagesForDebug(page)
    if (debug && debug.length) {
      log(`   🔍 DOM tenia ${debug.length} <img> >= 100px — diagnostico:`)
      debug.forEach((d, i) => {
        log(`      [${i}] ${d.natural} rect=${d.rect} complete=${d.complete} alt="${d.alt}"`)
        log(`          src=${d.src}`)
      })
    } else {
      log('   🔍 DOM no tiene ninguna <img> >= 100px (ni siquiera placeholders)')
    }
  } catch (e) {
    log(`   🔍 dumpImagesForDebug fallo: ${e.message}`)
  }
  return null
}

async function downloadImage(context, imgInfo, slug) {
  // context.request.get hereda las cookies del contexto del browser
  // (sesion ChatGPT) y descarga server-side desde Playwright. Mas
  // robusto que page.evaluate(fetch) — sin problemas de serializacion
  // del ArrayBuffer entre browser y Node.
  if (!existsSync(DOWNLOADS_DIR)) mkdirSync(DOWNLOADS_DIR, { recursive: true })
  const resp = await context.request.get(imgInfo.src)
  if (!resp.ok()) {
    throw new Error(`download HTTP ${resp.status()}`)
  }
  const buf = await resp.body()
  if (buf.length < 1024) {
    throw new Error(`download demasiado pequeno (${buf.length} bytes) — posible error`)
  }
  const outPath = join(DOWNLOADS_DIR, `${slug}.png`)
  writeFileSync(outPath, buf)
  return outPath
}

async function saveErrorScreenshot(page, slug) {
  try {
    if (!existsSync(ERRORS_DIR)) mkdirSync(ERRORS_DIR, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const path = join(ERRORS_DIR, `${slug}-${ts}.png`)
    await page.screenshot({ path, fullPage: false })
    log(`   📸 Screenshot del error: ${path}`)
  } catch {
    /* ignore */
  }
}

async function procesarPrompt(page, context, slug, prompt, intento) {
  await startNewChat(page)
  const promptForzado = `Generate this image: ${prompt}`
  await typeHumanLike(page, promptForzado)
  log(`   Tipeado (${promptForzado.length} chars), enviando…`)
  await sendPrompt(page)
  log('   Esperando imagen…')
  const img = await waitForGeneratedImage(page)
  if (!img) {
    throw new Error(intento < MAX_RETRIES_PER_PROMPT ? 'no-image (will retry)' : 'no-image (final)')
  }
  log(`   Imagen detectada (${img.width}x${img.height}), descargando…`)
  await wait(randInt(POST_GENERATION_WAIT))
  const outPath = await downloadImage(context, img, slug)
  return outPath
}

async function run() {
  const resume = process.argv.includes('--resume')
  const prompts = loadPrompts()
  const state = resume
    ? loadState()
    : { done: [], skipped: [], lastIndex: -1, startedAt: new Date().toISOString() }
  if (!state.skipped) state.skipped = []

  log(`Cargados ${prompts.length} prompts. ${resume ? 'Reanudando' : 'Iniciando desde cero'}.`)
  log(`Ya hechos: ${state.done.length}. Saltados: ${state.skipped.length}. Siguiente: index ${state.lastIndex + 1}.`)

  if (!existsSync(DOWNLOADS_DIR)) mkdirSync(DOWNLOADS_DIR, { recursive: true })

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    // viewport: null deja que la ventana ajuste a su tamaño nativo y
    // permite que el usuario la redimensione libremente sin que Playwright
    // fuerce un tamaño fijo. Modo ventana cómodo.
    viewport: null,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      // Ventana maximizada al arrancar, pero el user puede redimensionar
      '--start-maximized',
    ],
  })
  const page = context.pages()[0] || (await context.newPage())

  const cookies = await context.cookies('https://chatgpt.com')
  const tieneSesion = cookies.some((c) => c.name.includes('__Secure-next-auth.session-token'))
  if (!tieneSesion) {
    log('⚠️  No hay sesion guardada. Abriendo ChatGPT — loguea con tu cuenta Pro.')
    await page.goto('https://chatgpt.com/auth/login')
    log('   Cuando estes en la interfaz del chat, vuelve a esta terminal y pulsa ENTER.')
    process.stdin.resume()
    await new Promise((resolve) => process.stdin.once('data', resolve))
    process.stdin.pause()
  }

  let promptsDesdePausaLarga = 0

  for (let i = state.lastIndex + 1; i < prompts.length; i++) {
    const { slug, prompt, category } = prompts[i]
    log(`\n━━━ [${i + 1}/${prompts.length}] ${slug} (${category}) ━━━`)

    let exito = false
    let ultError = null
    for (let intento = 1; intento <= MAX_RETRIES_PER_PROMPT + 1; intento++) {
      try {
        if (intento > 1) log(`   🔁 Retry ${intento}/${MAX_RETRIES_PER_PROMPT + 1}`)
        const outPath = await procesarPrompt(page, context, slug, prompt, intento)
        log(`   ✅ Guardado: ${outPath}`)
        state.done.push({ slug, index: i, savedAt: new Date().toISOString() })
        state.lastIndex = i
        saveState(state)
        promptsDesdePausaLarga++
        exito = true
        break
      } catch (err) {
        ultError = err
        log(`   ❌ Intento ${intento} fallo: ${err.message}`)
        await saveErrorScreenshot(page, `${slug}-attempt${intento}`)
        if (intento <= MAX_RETRIES_PER_PROMPT) {
          const espera = randInt([10000, 25000])
          log(`   Esperando ${Math.round(espera / 1000)}s antes de retry…`)
          await wait(espera)
        }
      }
    }

    if (!exito) {
      log(`   ⏭️  Saltando ${slug} tras ${MAX_RETRIES_PER_PROMPT + 1} intentos fallidos`)
      state.skipped.push({ slug, index: i, error: ultError?.message, at: new Date().toISOString() })
      state.lastIndex = i
      saveState(state)
    }

    // Pausa larga cada N prompts para variar el ritmo
    if (promptsDesdePausaLarga >= LONG_PAUSE_EVERY) {
      const pausa = randInt(LONG_PAUSE_DURATION)
      log(`\n💤 Pausa larga de ${Math.round(pausa / 1000)}s para variar el patron temporal…`)
      await wait(pausa)
      promptsDesdePausaLarga = 0
    } else if (i < prompts.length - 1) {
      const delay = randInt(DELAY_BETWEEN_PROMPTS)
      log(`   Wait ${Math.round(delay / 1000)}s antes del siguiente…`)
      await wait(delay)
    }
  }

  log('\n✅ Batch completo.')
  log(`Imagenes en: ${DOWNLOADS_DIR}`)
  log(`OK: ${state.done.length} | SKIPPED: ${state.skipped.length}`)
  if (state.skipped.length) {
    log('Saltados:')
    state.skipped.forEach((s) => log(`  - ${s.slug} (${s.error})`))
  }
  await context.close()
}

run().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
