/**
 * Mapeo código de badge → kanji asociado.
 *
 * <p>Cada badge tiene un kanji semánticamente relacionado que se muestra
 * como overlay sutil en BadgeCard, dando identidad japonesa sin tocar el
 * schema de BBDD (la columna `icono` sigue siendo nombre Lucide para el
 * icono primario).
 *
 * <p>Los kanji elegidos siguen la lógica cultural:
 * - 初 (sho, "primero") · primer_voto
 * - 百 (hyaku, "100") · cien_votos
 * - 千 (sen, "1000") · mil_votos
 * - 王 (ō, "rey") · torneo_completo (campeón)
 * - 預 (yo, "presagiar") · profeta
 * - 連 (ren, "consecutivo") · predicciones_*_seguidas
 * - 戦 (sen, "batalla") · cazador_villanos
 * - 一 (ichi, "uno", único) · voto_minoritario
 * - 萌 (moe, "brote/afecto") · fanboy_anime
 * - 友 (tomo, "amigo") · reclutador
 * - 日 (nichi, "día") · daily_streak_*
 *
 * <p>Si un badge nuevo se añade sin entrada aquí, BadgeCard simplemente no
 * mostrará overlay kanji (graceful fallback).
 */
export const BADGE_KANJI = {
  primer_voto: '初',
  cien_votos: '百',
  mil_votos: '千',
  torneo_completo: '王',
  profeta: '預',
  predicciones_3_seguidas: '連',
  predicciones_10_seguidas: '連',
  cazador_villanos: '戦',
  voto_minoritario: '独',
  fanboy_anime: '萌',
  reclutador: '友',
  daily_streak_7: '日',
  daily_streak_30: '月',
  daily_streak_100: '年',
}

export function kanjiDeBadge(codigo) {
  return BADGE_KANJI[codigo] ?? null
}
