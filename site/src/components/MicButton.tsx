import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateText } from "@/lib/translate";

type Props = {
  /** Called with the (possibly translated) final transcript. Append-style. */
  onTranscript: (text: string) => void;
  /** Optional callback as the user is still speaking — interim results. */
  onInterim?: (text: string) => void;
  /** If true, transcript will be translated to the app language before delivery. */
  translateToAppLanguage?: boolean;
  /** Override the recognition locale (defaults to the app language). */
  locale?: string;
  className?: string;
  size?: "sm" | "md";
  title?: string;
};

// Minimal Web Speech API typing — avoid pulling lib.dom stage-3 types.
type SR = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const getSpeechRecognition = (): { ctor: new () => SR } | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return ctor ? { ctor } : null;
};

export const isSpeechRecognitionSupported = () => !!getSpeechRecognition();

export const MicButton = ({
  onTranscript,
  onInterim,
  translateToAppLanguage = true,
  locale,
  className,
  size = "sm",
  title,
}: Props) => {
  const { language, bcp47 } = useLanguage();
  const recRef = useRef<SR | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    return () => {
      try {
        recRef.current?.stop?.();
      } catch {
        /* noop */
      }
      recRef.current = null;
    };
  }, []);

  const start = () => {
    const sr = getSpeechRecognition();
    if (!sr) {
      setSupported(false);
      return;
    }
    const rec: SR = new sr.ctor();
    rec.lang = locale ?? bcp47;
    rec.interimResults = !!onInterim;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += t;
        else interim += t;
      }
      if (interim && onInterim) onInterim(interim);
      if (finalText) {
        const out = translateToAppLanguage ? translateText(finalText, language) : finalText;
        onTranscript(out);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop?.();
    } catch {
      /* noop */
    }
    setListening(false);
  };

  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          dim,
          "shrink-0 rounded-md flex items-center justify-center text-muted-foreground/50 cursor-not-allowed",
          className,
        )}
        title="Voice input is not supported in this browser"
        aria-label="Voice input unsupported"
      >
        <MicOff className={icon} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={cn(
        dim,
        "shrink-0 rounded-md flex items-center justify-center transition-colors",
        listening
          ? "bg-destructive/15 text-destructive ring-1 ring-destructive/40 animate-pulse"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        className,
      )}
      title={title ?? (listening ? "Stop listening" : "Speak")}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      aria-pressed={listening}
    >
      <Mic className={icon} />
    </button>
  );
};
