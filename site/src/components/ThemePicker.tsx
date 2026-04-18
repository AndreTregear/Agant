import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Hex -> "H S% L%"
function hexToHslString(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Relative luminance for contrast decisions
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => {
    const v = parseInt(clean.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

// Returns "0 0% 0%" (black) or "0 0% 100%" (white) — whichever contrasts better
function contrastForeground(hex: string): string {
  return luminance(hex) > 0.55 ? "0 0% 10%" : "0 0% 100%";
}

type Swatch = { name: string; hex: string };

const ACCENTS: Swatch[] = [
  { name: "Amber", hex: "#F3A712" },
  { name: "Cobalt", hex: "#4472CA" },
  { name: "Vermilion", hex: "#F42C04" },
  { name: "Mint", hex: "#AFE3C0" },
  { name: "Crimson", hex: "#CA1551" },
  { name: "Olive", hex: "#87A330" },
  { name: "Cyan", hex: "#01FDF6" },
  { name: "Lavender", hex: "#CBBAED" },
  { name: "Teal", hex: "#315659" },
  { name: "Rust", hex: "#D36135" },
  { name: "Sky", hex: "#5AA9E6" },
  { name: "Powder", hex: "#7FC8F8" },
  { name: "Butter", hex: "#FFE45E" },
  { name: "Pink", hex: "#FF6392" },
];

type Mode = "dark" | "light";

const STORAGE_KEY = "signal-theme";

const DEFAULTS = {
  accent: "#315659",
  mode: "dark" as Mode,
};

// Parse "H S% L%" into numbers
function parseHsl(hsl: string): { h: number; s: number; l: number } {
  const [h, s, l] = hsl.replace(/%/g, "").split(" ").map(Number);
  return { h, s, l };
}

// Complementary hue (opposite on color wheel), darkened for background use
function complementaryBg(accentHsl: string, mode: Mode): string {
  const { h, s } = parseHsl(accentHsl);
  const compH = (h + 180) % 360;
  // Keep saturation subtle, lightness very low for dark mode / very high for light mode
  const compS = Math.min(s, 30);
  const compL = mode === "dark" ? 6 : 97;
  return `${compH} ${compS}% ${compL}%`;
}

function applyTheme(accent: string, mode: Mode) {
  const root = document.documentElement;
  const accentHsl = hexToHslString(accent);
  const accentFg = contrastForeground(accent);
  const compBg = complementaryBg(accentHsl, mode);

  root.style.setProperty("--primary", accentHsl);
  root.style.setProperty("--primary-foreground", accentFg);
  root.style.setProperty("--primary-glow", accentHsl);
  root.style.setProperty("--accent", accentHsl);
  root.style.setProperty("--accent-foreground", accentFg);
  root.style.setProperty("--ring", accentHsl);
  // Complementary background tint, used by the hero gradient
  root.style.setProperty("--bg-complement", compBg);

  if (mode === "dark") {
    root.style.setProperty("--background", compBg);
    root.style.setProperty("--foreground", "210 40% 98%");
    root.style.setProperty("--card", "222 40% 9%");
    root.style.setProperty("--card-foreground", "210 40% 98%");
    root.style.setProperty("--popover", "222 40% 9%");
    root.style.setProperty("--popover-foreground", "210 40% 98%");
    root.style.setProperty("--secondary", "217 33% 14%");
    root.style.setProperty("--secondary-foreground", "210 40% 98%");
    root.style.setProperty("--muted", "217 33% 12%");
    root.style.setProperty("--muted-foreground", "215 20% 65%");
    root.style.setProperty("--border", "215 20% 22%");
    root.style.setProperty("--input", "217 33% 14%");
    root.classList.remove("light");
  } else {
    root.style.setProperty("--background", compBg);
    root.style.setProperty("--foreground", "222 47% 11%");
    root.style.setProperty("--card", "0 0% 100%");
    root.style.setProperty("--card-foreground", "222 47% 11%");
    root.style.setProperty("--popover", "0 0% 100%");
    root.style.setProperty("--popover-foreground", "222 47% 11%");
    root.style.setProperty("--secondary", "220 14% 94%");
    root.style.setProperty("--secondary-foreground", "222 47% 11%");
    root.style.setProperty("--muted", "220 14% 94%");
    root.style.setProperty("--muted-foreground", "222 15% 35%");
    root.style.setProperty("--border", "220 13% 85%");
    root.style.setProperty("--input", "220 14% 94%");
    root.classList.add("light");
  }
}

export function ThemePicker() {
  // Applied (live) theme
  const [appliedAccent, setAppliedAccent] = useState<string>(DEFAULTS.accent);
  const [appliedMode, setAppliedMode] = useState<Mode>(DEFAULTS.mode);

  // Draft theme (preview only — not applied until user clicks Apply)
  const [draftAccent, setDraftAccent] = useState<string>(DEFAULTS.accent);
  const [draftMode, setDraftMode] = useState<Mode>(DEFAULTS.mode);

  const [open, setOpen] = useState(false);

  // Load on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) {
        setAppliedAccent(saved.accent ?? DEFAULTS.accent);
        setAppliedMode(saved.mode ?? DEFAULTS.mode);
        setDraftAccent(saved.accent ?? DEFAULTS.accent);
        setDraftMode(saved.mode ?? DEFAULTS.mode);
        applyTheme(saved.accent ?? DEFAULTS.accent, saved.mode ?? DEFAULTS.mode);
        return;
      }
    } catch {
      // ignore
    }
    applyTheme(DEFAULTS.accent, DEFAULTS.mode);
  }, []);

  // When opening, sync draft to applied
  useEffect(() => {
    if (open) {
      setDraftAccent(appliedAccent);
      setDraftMode(appliedMode);
    }
  }, [open, appliedAccent, appliedMode]);

  const apply = () => {
    setAppliedAccent(draftAccent);
    setAppliedMode(draftMode);
    applyTheme(draftAccent, draftMode);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accent: draftAccent, mode: draftMode })
    );
    setOpen(false);
  };

  const reset = () => {
    setDraftAccent(DEFAULTS.accent);
    setDraftMode(DEFAULTS.mode);
  };

  const dirty = draftAccent !== appliedAccent || draftMode !== appliedMode;

  // Preview swatch foreground
  const previewBg = draftMode === "dark" ? "#0A1020" : "#F9F9F9";
  const previewFg = draftMode === "dark" ? "#fff" : "#111";
  const accentFgHex =
    luminance(draftAccent) > 0.55 ? "#111" : "#fff";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Open theme picker"
          className="fixed right-4 bottom-4 z-50 h-12 w-12 rounded-full bg-card border border-border shadow-elegant flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Palette className="h-5 w-5 text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 p-0 bg-popover border-border shadow-elegant"
      >
        <Tabs defaultValue="accents" className="w-full">
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Customize theme
            </h3>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="accents" className="text-xs">Accents</TabsTrigger>
              <TabsTrigger value="mode" className="text-xs">Mode</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="accents" className="p-4 mt-0">
            <div className="grid grid-cols-5 gap-2">
              {ACCENTS.map((s) => {
                const selected = draftAccent.toLowerCase() === s.hex.toLowerCase();
                return (
                  <button
                    key={s.hex}
                    onClick={() => setDraftAccent(s.hex)}
                    title={`${s.name} ${s.hex}`}
                    aria-label={s.name}
                    className={cn(
                      "h-10 w-10 rounded-md border-2 transition-transform hover:scale-110 flex items-center justify-center",
                      selected ? "border-foreground" : "border-border"
                    )}
                    style={{ backgroundColor: s.hex }}
                  >
                    {selected && (
                      <Check
                        className="h-4 w-4"
                        style={{ color: luminance(s.hex) > 0.55 ? "#111" : "#fff" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="mode" className="p-4 mt-0">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDraftMode("dark")}
                className={cn(
                  "p-4 rounded-md border-2 text-sm font-medium",
                  draftMode === "dark" ? "border-primary" : "border-border"
                )}
                style={{ backgroundColor: "#0A1020", color: "#fff" }}
              >
                Dark
              </button>
              <button
                onClick={() => setDraftMode("light")}
                className={cn(
                  "p-4 rounded-md border-2 text-sm font-medium",
                  draftMode === "light" ? "border-primary" : "border-border"
                )}
                style={{ backgroundColor: "#F9F9F9", color: "#111" }}
              >
                Light
              </button>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="p-4 mt-0 space-y-3">
            <div
              className="rounded-md p-4 border"
              style={{
                backgroundColor: previewBg,
                color: previewFg,
                borderColor: draftAccent,
              }}
            >
              <div className="text-xs opacity-70 mb-1">Preview</div>
              <div className="text-base font-semibold mb-2">Signal AI</div>
              <div className="text-xs opacity-80 mb-3">
                Private AI for your business.
              </div>
              <div
                className="inline-block rounded px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: draftAccent, color: accentFgHex }}
              >
                Get started
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Accent {draftAccent} · {draftMode}
            </div>
          </TabsContent>

          <div className="flex items-center gap-2 p-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={reset}
            >
              Reset
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-primary text-primary-foreground"
              onClick={apply}
              disabled={!dirty}
            >
              Apply
            </Button>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
