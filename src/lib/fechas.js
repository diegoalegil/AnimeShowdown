// Fechas legibles para la colección, sin depender del Intl del navegador
// (así «12 sep» se escribe igual en todos).

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * «12 sep» para un día AAAA-MM-DD del año en curso y «12 sep 2025» si es de
 * otro año. Devuelve '' si la fecha no es válida.
 */
export function diaCorto(dia, hoy) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia ?? '')
  if (!partes) return ''
  const [, ano, mes, d] = partes
  const nombreMes = MESES[Number(mes) - 1]
  if (!nombreMes) return ''
  const texto = `${Number(d)} ${nombreMes}`
  return hoy?.startsWith(ano) ? texto : `${texto} ${ano}`
}
