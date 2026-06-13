/**
 * Adapter de storage del expediente (/mi-ranking): aísla a
 * PersonalDossier de las claves reales. Convenciones de clave del
 * resto del ranking local (animeshowdown.local-votes.v1,
 * animeshowdown.mitop5.v1).
 *
 * Singleton de módulo a propósito: el effect de montaje/desmontaje del
 * componente depende de esta referencia — si se recreara por render,
 * dispararía guardados espurios.
 */

const SNAPSHOT_KEY = 'animeshowdown.mi-ranking.snapshot.v1'
const GLOBAL_PREF_KEY = 'animeshowdown.mi-ranking.global.v1'

export const dossierStorage = {
  /** @returns {{ranks: Record<string, number>, savedAt: number}|null} null ⇒ primera visita */
  loadSnapshot() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY)
      if (!raw) return null
      const snap = JSON.parse(raw)
      if (!snap || typeof snap !== 'object' || !snap.ranks) return null
      return snap
    } catch {
      return null
    }
  },

  saveSnapshot(snap) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap))
    } catch {
      // storage lleno/bloqueado: el expediente sigue funcionando sin memoria
    }
  },

  /** @returns {boolean|null} null ⇒ sin preferencia guardada (default true) */
  loadGlobalPref() {
    try {
      const raw = localStorage.getItem(GLOBAL_PREF_KEY)
      if (raw === 'true') return true
      if (raw === 'false') return false
      return null
    } catch {
      return null
    }
  },

  saveGlobalPref(value) {
    try {
      localStorage.setItem(GLOBAL_PREF_KEY, String(Boolean(value)))
    } catch {
      // ignore
    }
  },
}
