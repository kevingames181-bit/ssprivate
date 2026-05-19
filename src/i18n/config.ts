import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import jaTranslations from './locales/ja.json';
import koTranslations from './locales/ko.json';
import ruTranslations from './locales/ru.json';

const resources = {
  en: { translation: enTranslations },
  es: { translation: esTranslations },
  ja: { translation: jaTranslations },
  ko: { translation: koTranslations },
  ru: { translation: ruTranslations },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'ja', 'ko', 'ru'],
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
