import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import es from '../locales/es.json'
import en from '../locales/en.json'
import ja from '../locales/ja.json'

/**
 * Configuración i18n de AnimeShowdown.
 *
 * <p>Idiomas activos en esta iteración:
 * <ul>
 *   <li>{@code es} (default) — copy original del sitio.</li>
 *   <li>{@code en} — traducción funcional del shell y CTAs principales.</li>
 *   <li>{@code ja} — paridad de keys del sistema i18n actual.</li>
 * </ul>
 * Páginas todavía sin traducir caen al fallback ES vía namespace.
 *
 * <p>El detector lee {@code localStorage.i18nextLng} (cookie de preferencia
 * persistente al cambiar idioma) y, si no hay valor, recurre a {@code navigator.language}.
 * Si el idioma detectado no está soportado vuelve a {@code fallbackLng=es}.
 *
 * <p>Nota: todavía hay copy hardcodeado fuera de i18n; este módulo cubre
 * el shell y las páginas que ya usan {@code t()}.
 */
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            es: { translation: es },
            en: { translation: en },
            ja: { translation: ja },
        },
        fallbackLng: 'es',
        supportedLngs: ['es', 'en', 'ja'],
        nonExplicitSupportedLngs: true, // 'es-ES' → 'es', 'en-US' → 'en', 'ja-JP' → 'ja'
        interpolation: {
            // React ya escapa por defecto — desactivamos el escape de i18n
            // para no doblarlo y poder usar < > & sin distorsión en copy.
            escapeValue: false,
        },
        detection: {
            // No usamos 'navigator' como fallback. Resultado: usuarios con
            // navigator.language=en-US (Safari
            // por config del SO) veían el header traducido a EN ("Tournaments",
            // "Home") mientras el resto del sitio seguía hardcoded en ES (la
            // mayoría de páginas no llama a t()). El mix daba sensación de
            // producto a medio traducir.
            //
            // La identidad del sitio es ES — el bundle EN/JA está incompleto y
            // solo cubre header + algunos CTAs. Para evitar el efecto mix:
            //   - Solo respetamos localStorage.i18nextLng (selección explícita
            //     del user vía el toggle de idioma del header).
            //   - Sin localStorage, caemos a fallbackLng=es directamente, sin
            //     consultar navigator.
            // Cuando el bundle EN/JA esté completo, podemos reintroducir
            // 'navigator' como fallback secundario.
            order: ['localStorage'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },
        returnEmptyString: false,
    })

export default i18n
