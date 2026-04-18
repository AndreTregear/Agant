import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type AppLanguage = "en" | "es" | "ru";

export const LANGUAGES: Record<AppLanguage, { label: string; flag: string; bcp47: string }> = {
  en: { label: "English", flag: "🇺🇸", bcp47: "en-US" },
  es: { label: "Español", flag: "🇪🇸", bcp47: "es-ES" },
  ru: { label: "Русский", flag: "🇷🇺", bcp47: "ru-RU" },
};

type Ctx = {
  language: AppLanguage;
  setLanguage: (l: AppLanguage) => void;
  bcp47: string;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "agant.lang";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return "en";
    const v = window.localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    return v && LANGUAGES[v] ? v : "en";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: setLanguageState, bcp47: LANGUAGES[language].bcp47 }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
};
