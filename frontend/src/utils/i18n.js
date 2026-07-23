import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import ml from "../locales/ml.json";
import mlGenerated from "../locales/ml.generated.json";

const mlResources = { ...mlGenerated, ...ml };

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ml: { translation: mlResources }
    },
    lng: localStorage.getItem("ksmart_language") || "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
