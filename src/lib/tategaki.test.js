import { describe, expect, it } from 'vitest'
import { columnasNombre, trozosTate } from './tategaki.js'

describe('trozosTate', () => {
  it('pone de pie las cifras cortas y los signos dobles', () => {
    expect(trozosTate('人造人間18号')).toEqual([
      { texto: '人造人間', tcy: false },
      { texto: '18', tcy: true },
      { texto: '号', tcy: false },
    ])
    expect(trozosTate('ハイキュー!!')).toEqual([
      { texto: 'ハイキュー', tcy: false },
      { texto: '!!', tcy: true },
    ])
  })

  it('pasa a ancho completo los signos sueltos y las cifras largas', () => {
    expect(trozosTate('恋がしたい!')).toEqual([{ texto: '恋がしたい！', tcy: false }])
    expect(trozosTate('第1000話')).toEqual([{ texto: '第１０００話', tcy: false }])
    expect(trozosTate('フリーレン')).toEqual([{ texto: 'フリーレン', tcy: false }])
  })
})

describe('columnasNombre', () => {
  it('deja en una columna los nombres cortos o sin ・', () => {
    expect(columnasNombre('フリーレン')).toEqual(['フリーレン'])
    expect(columnasNombre('アレクサンドアンデルセン神父様')).toEqual(['アレクサンドアンデルセン神父様'])
  })

  it('corta en dos por el ・ más cercano a la mitad', () => {
    expect(columnasNombre('エドワード・ウォン・ハウ・ペペル・チブルスキー4世')).toEqual([
      'エドワード・ウォン・ハウ・',
      'ペペル・チブルスキー4世',
    ])
    expect(columnasNombre('インテグラル・ファルブルケ・ウィンゲーツ・ヘルシング')).toEqual([
      'インテグラル・ファルブルケ・',
      'ウィンゲーツ・ヘルシング',
    ])
  })
})
