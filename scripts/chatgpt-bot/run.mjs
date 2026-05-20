#!/usr/bin/env node
/**
 * ChatGPT browser-automation batch generator (Playwright).
 *
 * Lee prompts.json, abre Chromium headed con un userDataDir persistente
 * (te logueas UNA vez la primera ejecucion y la sesion se reusa), y
 * itera por cada prompt: nuevo chat -> pega -> envia -> espera respuesta
 * por estado del UI (NO por timer fijo) -> descarga la imagen -> renombra
 * a slug.png -> wait random 8-20s -> siguiente.
 *
 * RIESGO: viola los TOS de OpenAI (seccion 2(a)(iii) prohibe "automated
 * or programmatic method to extract output"). Cuenta Pro puede ser
 * baneada. Defensas implementadas que reducen pero NO eliminan el riesgo:
 *
 *  - Browser HEADED real (no headless — detectable al instante).
 *  - userDataDir persistente: misma sesion del navegador real, cookies y
 *    fingerprint estables.
 *  - Delays random entre acciones (8-20s entre prompts).
 *  - Tipeo caracter-a-caracter con random delay (humanos no pegan).
 *  - Pausa larga (3-5min) cada 15 prompts para parecer human.
 *  - Captcha guard: si aparece un challenge, pausa y avisa para resolver
 *    a mano antes de continuar.
 *  - Estado persistente en state.json: si crashea o pausas con Ctrl+C,
 *    `npm run resume` retoma donde se quedo.
 *  - Logs detallados — cada accion se loggea con timestamp.
 *
 * NO usar contra cuenta principal sin entender el riesgo. Si OpenAI
 * detecta el patron de uso, el ban es a la cuenta entera (Pro + API +
 * billing). Recomendado: probar con primero los 3-4 prompts y observar.
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_FILE = join(__dirname, 'prompts.json')
const STATE_FILE = join(__dirname, 'state.json')
const USER_DATA_DIR = join(__dirname, 'user-data')
const DOWNLOADS_DIR = join(__dirname, 'downloads')

// Knobs anti-deteccion. NO subas estos numeros sin necesidad — cuanto
// mas rapido, mas evidente que es un bot.
const DELAY_BETWEEN_PROMPTS = [8000, 20000]   // 8-20s entre prompts
const TYPE_DELAY_PER_CHAR = [30, 70]          // ms entre caracteres al tipear
const LONG_PAUSE_EVERY = 15                   // cada N prompts, pausa larga
const LONG_PAUSE_DURATION = [180000, 300000]  // 3-5min de respiracion
const RESPONSE_TIMEOUT_MS = 180000            // hasta 3min para generar una imagen
const POST_GENERATION_WAIT = [2000, 5000]     // espera tras detectar imagen

// Selectores. Si OpenAI cambia el DOM, hay que actualizar AQUI.
const SELECTORS = {
  promptTextarea: '#prompt-textarea, textarea[data-id], textarea[placeholder*="Message"]',
  sendButton: 'button[data-testid="send-button"], button[aria-label*="Send"]',
  stopGenerating: 'button[aria-label*="Stop"], button[data-testid="stop-button"]',
  newChatButton: 'a[href="/"], button[aria-label*="New chat"]',
  generatedImage: 'img[src*="oaiusercontent"], img[alt*="Generated"]',
  challengeIframe: 'iframe[src*="challenges.cloudflare.com"], iframe[title*="hCaptcha"], iframe[title*="reCAPTCHA"]',
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
  const data = JSON.parse(readFileSync(PROMPTS_FILE, 'utf8'))
  return data.prompts
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
  // Algunas paginas devuelven texto "Verify you are human"
  const txt = await page.content()
  if (/verify you are human|attention required|cloudflare/i.test(txt)) return true
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

async function startNewChat(page) {
  // ChatGPT mantiene la conversacion abierta indefinidamente; abrir un
  // nuevo chat por cada prompt evita que la context window se sature y
  // que el modelo "recuerde" prompts anteriores que puedan sesgar la
  // imagen generada.
  //
  // OJO: NO forzamos modelo via query param porque ChatGPT5 ignora
  // ?model=gpt-4o y mantiene la seleccion del usuario. Antes de empezar
  // el batch, asegurate manualmente que el modo seleccionado NO es
  // "Thinking" (no genera imagenes) — usa "Auto" o ChatGPT 5 sin
  // razonamiento extendido.
  await page.goto('https://chatgpt.com/', {
    waitUntil: 'domcontentloaded',
  })
  await wait(randInt([1500, 3000]))
  await waitForChallenge(page)
}

async function typeHumanLike(page, selector, text) {
  // pegar (page.fill) es detectable. Tipear caracter a caracter con
  // delay random es indistinguible de un humano rapido.
  const el = await page.waitForSelector(selector, { timeout: 30000 })
  await el.click()
  await wait(randInt([200, 600]))
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: randInt(TYPE_DELAY_PER_CHAR) })
  }
  await wait(randInt([400, 900]))
}

async function sendPrompt(page) {
  // Primary: Enter sobre el textarea. Funciona en todas las versiones de
  // chatgpt.com y no depende de selectores que cambian. El textarea sigue
  // focuseado tras el typeHumanLike anterior asi que el Enter se aplica a
  // el directamente.
  //
  // Si por alguna razon Enter no dispara el send (ej. modo "Thinking" que
  // bloquea image generation y deshabilita el shortcut), probamos varios
  // selectores conocidos para el boton circular azul.
  await page.keyboard.press('Enter')
  await wait(800)
  // Verificar que la respuesta empezo: buscar el stop button. Si NO
  // aparece tras Enter, intentar click del send button como backup.
  const empezo = await page.$(SELECTORS.stopGenerating)
  if (!empezo) {
    log('   Enter no disparo el envio — intentando click del send button…')
    const sendSelectors = [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Enviar" i]',
      'button[type="submit"][class*="primary" i]',
      'form button[type="submit"]',
      // Como ultimo recurso: cualquier boton circular azul del composer
      'main button.rounded-full[class*="bg-"]',
    ]
    for (const sel of sendSelectors) {
      const btn = await page.$(sel)
      if (btn) {
        log(`   click ${sel}`)
        await btn.click()
        break
      }
    }
  }
}

async function waitForResponse(page) {
  // Esperar a que aparezca el boton "Stop generating" (la respuesta esta
  // empezando a generarse) y luego a que desaparezca (terminada).
  const t0 = Date.now()
  // Aparecer
  try {
    await page.waitForSelector(SELECTORS.stopGenerating, { timeout: 30000 })
  } catch {
    log('   No aparecio Stop generating — el envio quizas fallo')
  }
  // Desaparecer
  while (Date.now() - t0 < RESPONSE_TIMEOUT_MS) {
    const still = await page.$(SELECTORS.stopGenerating)
    if (!still) return true
    await wait(2000)
  }
  return false
}

async function downloadImage(page, slug, downloadsDir) {
  // Las imagenes generadas tienen src en oaiusercontent.com. Las hacemos
  // fetch en el contexto del browser (cookies validas) → blob → save.
  const imgSrc = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
      .filter((i) => /oaiusercontent\.com|cdn\.openai\.com/.test(i.src))
      .filter((i) => (i.naturalWidth || i.width) >= 256)
    return imgs.length ? imgs[imgs.length - 1].src : null
  })
  if (!imgSrc) throw new Error('No se detecto imagen generada')
  const buffer = await page.evaluate(async (src) => {
    const r = await fetch(src, { credentials: 'include' })
    if (!r.ok) throw new Error('fetch fallo ' + r.status)
    const b = await r.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsArrayBuffer(b)
    })
  }, imgSrc)
  // page.evaluate devuelve un ArrayBuffer serializado como objeto;
  // Playwright lo convierte a Buffer transparentemente.
  const buf = Buffer.from(buffer)
  if (!existsSync(downloadsDir)) mkdirSync(downloadsDir, { recursive: true })
  const outPath = join(downloadsDir, `${slug}.png`)
  writeFileSync(outPath, buf)
  return outPath
}

async function run() {
  const resume = process.argv.includes('--resume')
  const prompts = loadPrompts()
  const state = resume ? loadState() : { done: [], lastIndex: -1, startedAt: new Date().toISOString() }

  log(`Cargados ${prompts.length} prompts. ${resume ? 'Reanudando' : 'Iniciando desde cero'}.`)
  log(`Ya hechos: ${state.done.length}. Siguiente: index ${state.lastIndex + 1}.`)

  if (!existsSync(DOWNLOADS_DIR)) mkdirSync(DOWNLOADS_DIR, { recursive: true })

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1366, height: 900 },
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // Args para minimizar fingerprint de automation
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  })
  const page = context.pages()[0] || (await context.newPage())

  // Si es primera vez (userDataDir vacio): el user debe loguearse.
  const cookies = await context.cookies('https://chatgpt.com')
  const tieneSesion = cookies.some((c) => c.name.includes('__Secure-next-auth.session-token'))
  if (!tieneSesion) {
    log('⚠️  No hay sesion guardada. Abriendo ChatGPT — loguea con tu cuenta Pro.')
    await page.goto('https://chatgpt.com/auth/login')
    log('   Cuando estes en chat (interfaz principal), pulsa ENTER en esta terminal para continuar.')
    process.stdin.resume()
    await new Promise((resolve) => process.stdin.once('data', resolve))
    process.stdin.pause()
  }

  let promptsDesdePausaLarga = 0

  for (let i = state.lastIndex + 1; i < prompts.length; i++) {
    const { slug, prompt, category } = prompts[i]
    log(`\n━━━ [${i + 1}/${prompts.length}] ${slug} (${category}) ━━━`)
    try {
      await startNewChat(page)
      await typeHumanLike(page, SELECTORS.promptTextarea, prompt)
      log('   Prompt tipeado, enviando…')
      await sendPrompt(page)
      log('   Esperando respuesta…')
      const ok = await waitForResponse(page)
      if (!ok) {
        log('   ⏱️  Timeout esperando respuesta — saltando este prompt')
        state.lastIndex = i
        saveState(state)
        continue
      }
      await wait(randInt(POST_GENERATION_WAIT))
      log('   Descargando imagen…')
      const outPath = await downloadImage(page, slug, DOWNLOADS_DIR)
      log(`   ✅ Guardado: ${outPath}`)
      state.done.push({ slug, index: i, savedAt: new Date().toISOString() })
      state.lastIndex = i
      saveState(state)
      promptsDesdePausaLarga++
    } catch (err) {
      log(`   ❌ Error en ${slug}: ${err.message}`)
      log('   Pausa de 30s para que ChatGPT se recupere y siguiente…')
      await wait(30000)
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
  await context.close()
}

run().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
