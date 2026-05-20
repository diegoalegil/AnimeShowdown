/* eslint-disable */
/**
 *
 * backend; todo el procesamiento es client-side.
 *
 * Flow:
 *  1. Localiza todas las <img> generadas en la conversación filtrando
 *     por dominios oaiusercontent.com (canon DALL-E/GPT Image).
 *  2. Parsea el último mensaje del usuario buscando un guión tipo:
 *       1. naruto.png — ...
 *       2. one-piece.png — ...
 *     y asigna esos nombres a las imágenes en orden.
 *  3. Pinta un panel flotante con preview + input editable por imagen
 *     + botón "Descargar todas".
 *  4. Al pulsar descarga, dispara <a download="<slug>.png" href="<url>">
 *     .click() por cada imagen.
 *
 * permisivo desde su CDN y el navegador respeta el `download` attribute
 * cuando el origen está en la misma sesión autenticada.
 */
;(function () {

  // Cierra panel previo si volviste a pulsar el bookmarklet sin recargar
  const previo = document.getElementById(PANEL_ID)
  if (previo) {
    previo.remove()
    return
  }

  // ---------- Detección de imágenes generadas -----------------------
  // descartar avatares, logos UI y emojis.
  const HOSTS_VALIDOS = [
    'oaiusercontent.com',
    'files.oaiusercontent.com',
  ]

  function esImagenGenerada(img) {
    const src = img.src || ''
    if (!src.startsWith('https://')) return false
    if (!HOSTS_VALIDOS.some((h) => src.includes(h))) return false
    // Descartar miniaturas demasiado pequeñas (avatares 24x24 etc.)
    const w = img.naturalWidth || img.width || 0
    return w >= 256
  }

  const imagenes = Array.from(document.querySelectorAll('img'))
    .filter(esImagenGenerada)
    // Dedup por src (a veces se renderizan dos veces durante streaming)
    .filter((img, i, arr) => arr.findIndex((b) => b.src === img.src) === i)

  if (imagenes.length === 0) {
    alert(
      'No detecté imágenes generadas en esta conversación.\n' +
    )
    return
  }

  // ---------- Parseo de nombres desde el guión ----------------------
  // Buscamos en TODOS los mensajes del usuario el patrón:
  //   "1. naruto.png" / "1) naruto.png" / "1 - naruto.png" / "naruto.webp"
  // Asignamos en orden: la N-esima imagen detectada recibe el N-esimo
  // nombre encontrado.
  function extraerNombres() {
    const texto = document.body.innerText || ''
    // Regex: número (1-99) + separador + nombre.png/webp/jpg
    const re = /(?:^|\n)\s*(\d{1,3})[.\)\-:]?\s*[`'"]?([a-zA-Z0-9_-]+)\.(?:png|webp|jpg|jpeg)/gm
    const found = new Map()
    let m
    while ((m = re.exec(texto)) !== null) {
      const n = Number(m[1])
      if (!found.has(n)) found.set(n, m[2])
    }
    // Sort by N and return values
    return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, name]) => name)
  }

  const nombresGuion = extraerNombres()
  const propuestas = imagenes.map(
  )

  // ---------- Panel UI ---------------------------------------------
  const panel = document.createElement('div')
  panel.id = PANEL_ID
  Object.assign(panel.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '380px',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    background: '#0b1018',
    color: '#f4f0ea',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '14px',
    padding: '18px',
    zIndex: '2147483647',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    boxShadow: '0 24px 64px -16px rgba(0,0,0,0.7), 0 0 64px -16px rgba(255,46,99,0.25)',
  })

  const headerTitle = `${imagenes.length} imagen${imagenes.length > 1 ? 'es' : ''} detectada${imagenes.length > 1 ? 's' : ''}`
  const headerSub = nombresGuion.length
    ? `${nombresGuion.length} nombre${nombresGuion.length > 1 ? 's' : ''} encontrado${nombresGuion.length > 1 ? 's' : ''} en el guión`
    : 'Sin guión detectado (renombra a mano si quieres)'

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div style="font-weight:800;font-size:14px;">${headerTitle}</div>
        <div style="font-size:11px;color:#a7adbd;margin-top:2px;">${headerSub}</div>
      </div>
      <button id="__as_close" style="background:transparent;border:1px solid rgba(255,255,255,0.18);color:#f4f0ea;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px;">×</button>
    </div>
    <div id="__as_list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;"></div>
    <button id="__as_download" style="width:100%;padding:11px;background:linear-gradient(180deg,#e63b6a,#c2174a);border:1px solid rgba(255,46,99,0.55);color:white;font-weight:800;border-radius:10px;cursor:pointer;font-size:13px;box-shadow:0 0 28px -8px rgba(255,46,99,0.6);">
      Descargar todas (${imagenes.length})
    </button>
    <p style="font-size:10px;color:#6d7485;margin:10px 0 0;text-align:center;">
      Click derecho sobre el botón si tu navegador bloquea descargas múltiples.
    </p>
  `

  document.body.appendChild(panel)

  const lista = panel.querySelector('#__as_list')
  imagenes.forEach((img, i) => {
    const row = document.createElement('div')
    row.style.cssText =
      'display:flex;gap:10px;align-items:center;padding:8px;border-radius:8px;background:rgba(255,255,255,0.04);'
    row.innerHTML = `
      <img src="${img.src}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;" />
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:4px;">
          <input
            type="text"
            value="${propuestas[i]}"
            data-idx="${i}"
            class="__as_name"
            style="flex:1;min-width:0;background:#161b2a;border:1px solid rgba(255,255,255,0.10);color:#f4f0ea;padding:6px 8px;border-radius:6px;font-family:JetBrains Mono,monospace;font-size:11px;"
          />
          <span style="font-size:11px;color:#a7adbd;">.png</span>
        </div>
        <div style="font-size:10px;color:#6d7485;margin-top:3px;">
          ${img.naturalWidth || '?'} × ${img.naturalHeight || '?'}
        </div>
      </div>
    `
    lista.appendChild(row)
  })

  // ---------- Acciones --------------------------------------------
  panel.querySelector('#__as_close').addEventListener('click', () => panel.remove())

  panel.querySelector('#__as_download').addEventListener('click', async () => {
    const btn = panel.querySelector('#__as_download')
    btn.disabled = true
    btn.textContent = 'Descargando…'

    const inputs = panel.querySelectorAll('.__as_name')
    let ok = 0
    let fail = 0
    for (let i = 0; i < imagenes.length; i++) {
      const img = imagenes[i]
      try {
        // Fetch + Blob → URL.createObjectURL para forzar descarga con
        // nombre concreto. El `download` attribute solo lo respetan
        // hosts same-origin; con blob URL siempre funciona.
        const resp = await fetch(img.src, { credentials: 'include' })
        if (!resp.ok) throw new Error('http ' + resp.status)
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = nombre + '.png'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl)
          a.remove()
        }, 1000)
        ok++
        // Pequeño retraso entre descargas — algunos navegadores bloquean
        // descargas masivas como popup spam.
        await new Promise((r) => setTimeout(r, 250))
      } catch (e) {
        console.warn('Fallo descargando', img.src, e)
        fail++
      }
    }
    btn.textContent = `✓ ${ok} descargadas${fail ? ` (${fail} fallidas)` : ''}`
    btn.style.background = fail ? '#7a3a3a' : '#1f7a3a'
    setTimeout(() => panel.remove(), 2500)
  })
})()
