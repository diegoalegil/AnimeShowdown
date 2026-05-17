import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import es from '../locales/es.json'
import en from '../locales/en.json'

/**
 * Configuración i18n de AnimeShowdown (Plan v2 §4.11).
 *
 * <p>Idiomas activos en esta iteración:
 * <ul>
 *   <li>{@code es} (default) — copy original del sitio.</li>
 *   <li>{@code en} — traducción funcional del shell y CTAs principales.
 *       Páginas todavía sin traducir caen al fallback ES vía namespace.</li>
 * </ul>
 *
 * <p>El detector lee {@code localStorage.i18nextLng} (cookie de preferencia
 * persistente al cambiar idioma) y, si no hay valor, recurre a {@code navigator.language}.
 * Si el idioma detectado no está soportado vuelve a {@code fallbackLng=es}.
 *
 * <p>JP queda pendiente porque las descripciones de los 730 personajes
 * habría que traducirlas y eso es trabajo del Bloque 15.
 */
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            es: { translation: es },
            en: { translation: en },
        },
        fallbackLng: 'es',
        supportedLngs: ['es', 'en'],
        nonExplicitSupportedLngs: true, // 'es-ES' → 'es', 'en-US' → 'en'
        interpolation: {
            // React ya escapa por defecto — desactivamos el escape de i18n
            // para no doblarlo y poder usar < > & sin distorsión en copy.
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },
        returnEmptyString: false,
    })

export default i18n
