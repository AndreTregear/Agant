import { AppLanguage } from "@/contexts/LanguageContext";

/**
 * Lightweight, dependency-free demo translator.
 *
 * Real production translation should hit an LLM / translation API. For the
 * demo we tag the result so it's clear something happened, while keeping the
 * original content readable.
 */

const PREFIX: Record<AppLanguage, string> = {
  en: "",
  es: "[ES] ",
  ru: "[RU] ",
};

export const translateText = (text: string, target: AppLanguage): string => {
  if (!text) return text;
  if (target === "en") return text;
  return PREFIX[target] + text;
};
