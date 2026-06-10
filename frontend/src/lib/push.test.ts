import { describe, expect, it } from 'vitest'
import {
  arrayBufferToBase64Url,
  subscriptionPayload,
  urlBase64ToUint8Array,
} from './push'

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url con padding implicito', () => {
    // 'hi!' = aGkh en base64 (longitud no multiplo de 4 → padding implicito)
    const bytes = urlBase64ToUint8Array('aGkh')
    expect(Array.from(bytes)).toEqual([104, 105, 33])
  })

  it('es inversa de arrayBufferToBase64Url', () => {
    const original = new Uint8Array([1, 250, 62, 128, 255, 0, 33])
    const encoded = arrayBufferToBase64Url(original.buffer)
    expect(Array.from(urlBase64ToUint8Array(encoded))).toEqual(Array.from(original))
    // base64url: sin '+', '/' ni '=' (la VAPID key llega en este alfabeto)
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('subscriptionPayload', () => {
  it('usa las keys del toJSON cuando existen', () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      toJSON: () => ({ keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' } }),
      getKey: () => null,
    }
    expect(subscriptionPayload(subscription)).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' },
    })
  })

  it('cae a getKey() codificado base64url si toJSON no trae keys', () => {
    const p256dh = new Uint8Array([1, 2, 3]).buffer
    const auth = new Uint8Array([4, 5, 6]).buffer
    const subscription = {
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/xyz',
      toJSON: () => ({}),
      getKey: (name: 'p256dh' | 'auth') => (name === 'p256dh' ? p256dh : auth),
    }
    expect(subscriptionPayload(subscription)).toEqual({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/xyz',
      keys: {
        p256dh: arrayBufferToBase64Url(p256dh),
        auth: arrayBufferToBase64Url(auth),
      },
    })
  })

  it('lanza si la suscripcion esta incompleta', () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      toJSON: () => ({}),
      getKey: () => null,
    }
    expect(() => subscriptionPayload(subscription)).toThrow(/incompleta/)
  })
})
