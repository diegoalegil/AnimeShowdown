import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(__dirname, '../..')

function source(path: string) {
  return readFileSync(resolve(frontendRoot, path), 'utf8')
}

describe('Auth y perfil accessibility contracts', () => {
  it('enlaza los errores de forgot/reset password con sus campos', () => {
    const forgot = source('src/pages/ForgotPasswordPage.jsx')
    const reset = source('src/pages/ResetPasswordPage.jsx')

    expect(forgot).toContain("aria-describedby={errors.email ? 'forgot-email-error' : undefined}")
    expect(forgot).toContain('id="forgot-email-error"')

    for (const id of [
      'reset-email-error',
      'reset-codigo-help',
      'reset-codigo-error',
      'reset-new-password-help',
      'reset-new-password-error',
      'reset-confirm-password-error',
    ]) {
      expect(reset).toContain(id)
    }
  })

  it('mantiene la bio y el username picker anunciables por lectores de pantalla', () => {
    const cardBio = source('src/features/perfil/components/CardBio.jsx')
    const usernamePicker = source('src/components/onboarding/UsernamePicker.jsx')

    expect(cardBio).toContain('htmlFor="profile-bio"')
    expect(cardBio).toContain('aria-describedby="profile-bio-help profile-bio-counter"')
    expect(cardBio).toContain('id="profile-bio-counter"')

    expect(usernamePicker).toContain('aria-describedby="onboarding-username-status"')
    expect(usernamePicker).toContain("id: 'onboarding-username-status'")
    expect(usernamePicker).toContain("'aria-live': 'polite'")
    expect(usernamePicker).not.toContain('emerald-')
  })
})
