import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, TrendingUp, Brain, Workflow, BarChart3, Mail, Mic,
  Search, Bell, Settings, LogOut, Server, ShieldCheck, Activity, ChevronRight,
  Home, Send, Sparkles, Newspaper, ExternalLink, ChevronDown, X, Plus,
  LayoutGrid, Maximize2, Minus, Sun, Moon, Rows3, Square,
  Gavel, Clock, Scale, Users, FileText, AlertCircle, CalendarDays, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MicButton } from "@/components/MicButton";
import { useLanguage, LANGUAGES, AppLanguage } from "@/contexts/LanguageContext";
import { translateText } from "@/lib/translate";
import logoBg from "@/assets/logo-bg.jpg";

type ToolKey =
  | "home" | "vault" | "forecaster" | "email"
  | "knowledge" | "meeting" | "workflows" | "reports";

type Tool = {
  key: ToolKey;
  icon: typeof Home;
  name: string;
  desc: string;
};

// Ordered: home, wiki, meeting, workflows, reports, knowledge, email, forecaster.
const TOOLS: Tool[] = [
  { key: "home",       icon: Home,        name: "Home",              desc: "Workspace overview" },
  { key: "vault",      icon: BookOpen,    name: "Wiki",              desc: "Internal knowledge base" },
  { key: "meeting",    icon: Mic,         name: "Meeting Copilot",   desc: "Live in-meeting AI" },
  { key: "workflows",  icon: Workflow,    name: "Auto Workflows",    desc: "Cross-tool automation" },
  { key: "reports",    icon: BarChart3,   name: "Insight Reports",   desc: "On-demand briefs" },
  { key: "knowledge",  icon: Brain,       name: "Custom Knowledge",  desc: "Live fine-tuning" },
  { key: "email",      icon: Mail,        name: "Email Summarizer",  desc: "Inbox triage" },
  { key: "forecaster", icon: TrendingUp,  name: "Forecaster",        desc: "Outcome prediction" },
];

const INSTANT_ACCESS: { name: string; url: string; letter: string }[] = [
  { name: "Gmail", url: "https://mail.google.com", letter: "G" },
  { name: "Outlook", url: "https://outlook.office.com", letter: "O" },
  { name: "Schoology", url: "https://app.schoology.com", letter: "S" },
  { name: "Slack", url: "https://slack.com/signin", letter: "#" },
  { name: "Calendar", url: "https://calendar.google.com", letter: "C" },
  { name: "Drive", url: "https://drive.google.com", letter: "D" },
  { name: "Notion", url: "https://www.notion.so", letter: "N" },
  { name: "Zoom", url: "https://zoom.us", letter: "Z" },
];

const InstantAccessMenu = ({
  onOpen,
}: {
  onOpen: (site: { name: string; url: string; letter: string }) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span>Instant Access</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <nav className="space-y-0.5 mt-1 animate-fade-in">
          {INSTANT_ACCESS.map((s) => (
            <button
              key={s.name}
              onClick={() => onOpen(s)}
              className="group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-secondary/30 hover:text-foreground transition-colors text-left"
              title={`Open ${s.name} inside the platform`}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-[4px] border border-border bg-card flex items-center justify-center text-[9px] font-semibold"
                aria-hidden="true"
              >
                {s.letter}
              </span>
              <span className="truncate flex-1">{s.name}</span>
              <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

/* -------------------- External (Instant Access) windows -------------------- */

type ExtWindowState = {
  id: string;
  name: string;
  url: string;
  letter: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  groupId?: string;
};

type WindowStyle = "light" | "dark";
type WindowDensity = "compact" | "cozy";

type WindowState = {
  key: ToolKey;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  style: WindowStyle;
  density: WindowDensity;
  prev?: { x: number; y: number; w: number; h: number };
  groupId?: string;
};

type PersistedState = {
  windowMode: boolean;
  windows: WindowState[];
  zCounter: number;
};

const STORAGE_KEY = "agant.dashboard.v2";

const loadPersisted = (): PersistedState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

type Health = "healthy" | "degraded" | "down";

const ServerStatus = () => {
  const [health, setHealth] = useState<Health>("healthy");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const start = performance.now();
      try {
        // For demo: use site reachability (favicon as a lightweight ping).
        const res = await fetch(`${window.location.origin}/favicon.ico?_=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
        });
        const ms = performance.now() - start;
        if (cancelled) return;
        setLatency(Math.round(ms));
        if (!res.ok) setHealth("degraded");
        else if (ms > 1500) setHealth("degraded");
        else setHealth("healthy");
      } catch {
        if (cancelled) return;
        setLatency(null);
        setHealth("down");
      }
    };
    check();
    const id = setInterval(check, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dotClass =
    health === "healthy"
      ? "bg-emerald-500 shadow-[0_0_8px_hsl(142_76%_45%/0.8)]"
      : health === "degraded"
      ? "bg-yellow-400 shadow-[0_0_8px_hsl(48_96%_55%/0.8)]"
      : "bg-red-500 shadow-[0_0_8px_hsl(0_84%_60%/0.8)]";

  const label =
    health === "healthy" ? "On-prem · Healthy"
    : health === "degraded" ? "On-prem · Degraded"
    : "On-prem · Offline";

  const sub =
    health === "down"
      ? "Unreachable · check connection"
      : `${latency ?? "—"} ms · 14d uptime`;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-1.5 w-1.5 rounded-full animate-pulse-dot ${dotClass}`} />
        <span className="text-[11px] text-muted-foreground">Server status</span>
      </div>
      <div className="text-[12px] font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
};

/* -------------------- Quick AI chat popup -------------------- */

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

const QuickAiChat = () => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close on outside click — but keep state intact (just hide UI)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popupRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // Auto-scroll to latest
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, thinking]);

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);
    // Mock assistant — replace with Lovable AI call when wired up.
    // Reply is translated to the user's chosen language.
    window.setTimeout(() => {
      const baseReply =
        "Got it. (This is a placeholder reply — connect Lovable Cloud to enable live AI answers.)";
      const reply: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: translateText(baseReply, language),
      };
      setMessages((m) => [...m, reply]);
      setThinking(false);
    }, 700);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={`absolute bottom-4 right-[68px] z-50 h-11 w-11 rounded-full border shadow-lg flex items-center justify-center transition-all ${
          open
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border hover:bg-secondary/60"
        }`}
        aria-label={open ? "Hide AI chat" : "Open AI chat"}
        title="Quick AI chat"
      >
        <Sparkles className="h-5 w-5" />
        {messages.length > 0 && !open && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
            {messages.filter((m) => m.role === "assistant").length}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popupRef}
          className="absolute bottom-[68px] right-4 z-50 w-[320px] max-h-[60vh] rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        >
          <div className="shrink-0 px-3 py-2 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[12px] font-medium">Ask Agant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-5 w-5 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              aria-label="Hide chat"
              title="Hide (history stays)"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-[12px] text-muted-foreground text-center py-6">
                Ask anything — summarize a thread, draft a reply, look up a doc.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-primary/15 text-foreground border border-primary/20"
                    : "mr-auto bg-secondary/40 text-foreground border border-border/60"
                }`}
              >
                {m.content}
              </div>
            ))}
            {thinking && (
              <div className="mr-auto bg-secondary/40 border border-border/60 rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse" />
                  <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:120ms]" />
                  <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:240ms]" />
                </span>
              </div>
            )}
          </div>

          <div className="shrink-0 p-2 border-t border-border/60 flex items-center gap-1.5">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask Agant…"
              className="h-8 text-[12px] bg-background border-border"
            />
            <MicButton
              onTranscript={(t) => setInput((v) => (v ? `${v} ${t}` : t))}
              size="sm"
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={send}
              disabled={!input.trim() || thinking}
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const initial = loadPersisted();

  const [windowMode, setWindowMode] = useState<boolean>(initial?.windowMode ?? false);
  const [windows, setWindows] = useState<WindowState[]>(initial?.windows ?? []);
  const [extWindows, setExtWindows] = useState<ExtWindowState[]>([]);
  const [zCounter, setZCounter] = useState<number>(initial?.zCounter ?? 10);
  const [editorOpen, setEditorOpen] = useState<ToolKey | null>(null);
  const [topSearch, setTopSearch] = useState("");
  const desktopRef = useRef<HTMLDivElement>(null);

  // Persist on every relevant change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ windowMode, windows, zCounter })
      );
    } catch {
      /* ignore quota */
    }
  }, [windowMode, windows, zCounter]);

  const focus = useCallback((key: ToolKey) => {
    setZCounter((z) => {
      const next = z + 1;
      setWindows((ws) =>
        ws.map((w) => (w.key === key ? { ...w, z: next, minimized: false } : w))
      );
      return next;
    });
  }, []);

  const openTool = (key: ToolKey) => {
    // If window mode is off, just turn it on and open as a window
    if (!windowMode) setWindowMode(true);

    setWindows((ws) => {
      const existing = ws.find((w) => w.key === key);
      if (existing) {
        return ws.map((w) =>
          w.key === key ? { ...w, minimized: false, z: zCounter + 1 } : w
        );
      }
      const offset = ws.length * 28;
      const desktop = desktopRef.current;
      const dw = desktop?.clientWidth ?? 800;
      const dh = desktop?.clientHeight ?? 600;
      const w = Math.min(720, Math.max(360, dw - 80));
      const h = Math.min(520, Math.max(320, dh - 80));
      return [
        ...ws,
        {
          key,
          x: 40 + offset,
          y: 24 + offset,
          w,
          h,
          z: zCounter + 1,
          minimized: false,
          maximized: false,
          style: "dark",
          density: "cozy",
        },
      ];
    });
    setZCounter((z) => z + 1);
  };

  const closeWindow = (key: ToolKey) => {
    setWindows((ws) => ws.filter((w) => w.key !== key));
    if (editorOpen === key) setEditorOpen(null);
  };

  const minimizeWindow = (key: ToolKey) =>
    setWindows((ws) => ws.map((w) => (w.key === key ? { ...w, minimized: true } : w)));

  const toggleMaximize = (key: ToolKey) => {
    const desktop = desktopRef.current;
    if (!desktop) return;
    const dw = desktop.clientWidth;
    const dh = desktop.clientHeight;
    setWindows((ws) =>
      ws.map((w) => {
        if (w.key !== key) return w;
        if (w.maximized && w.prev) {
          return { ...w, ...w.prev, maximized: false, prev: undefined };
        }
        return {
          ...w,
          prev: { x: w.x, y: w.y, w: w.w, h: w.h },
          x: 0,
          y: 0,
          w: dw,
          h: dh,
          maximized: true,
        };
      })
    );
  };

  const snapWindow = (key: ToolKey, zone: SnapZone) => {
    const desktop = desktopRef.current;
    if (!desktop) return;
    const dw = desktop.clientWidth;
    const dh = desktop.clientHeight;

    const rects: Record<SnapZone, { x: number; y: number; w: number; h: number }> = {
      "left-half":   { x: 0,         y: 0, w: dw / 2, h: dh },
      "right-half":  { x: dw / 2,    y: 0, w: dw / 2, h: dh },
      "left-third":  { x: 0,         y: 0, w: dw / 3, h: dh },
      "right-third": { x: dw - dw/3, y: 0, w: dw / 3, h: dh },
      "top-left-quarter":     { x: 0,      y: 0,      w: dw / 2, h: dh / 2 },
      "top-right-quarter":    { x: dw / 2, y: 0,      w: dw / 2, h: dh / 2 },
      "bottom-left-quarter":  { x: 0,      y: dh / 2, w: dw / 2, h: dh / 2 },
      "bottom-right-quarter": { x: dw / 2, y: dh / 2, w: dw / 2, h: dh / 2 },
    };
    const r = rects[zone];
    setWindows((ws) =>
      ws.map((w) =>
        w.key === key
          ? { ...w, x: r.x, y: r.y, w: r.w, h: r.h, maximized: false, prev: undefined }
          : w
      )
    );
  };

  const updateWindow = (key: ToolKey, patch: Partial<WindowState>) =>
    setWindows((ws) => ws.map((w) => (w.key === key ? { ...w, ...patch } : w)));

  /* ---- External (Instant Access) windows ---- */
  const focusExt = useCallback((id: string) => {
    setZCounter((z) => {
      const next = z + 1;
      setExtWindows((ws) =>
        ws.map((w) => (w.id === id ? { ...w, z: next, minimized: false } : w))
      );
      return next;
    });
  }, []);

  const openExternal = (site: { name: string; url: string; letter: string }) => {
    if (!windowMode) setWindowMode(true);
    setExtWindows((ws) => {
      const existing = ws.find((w) => w.url === site.url);
      if (existing) {
        return ws.map((w) =>
          w.url === site.url ? { ...w, minimized: false, z: zCounter + 1 } : w
        );
      }
      const offset = (windows.length + ws.length) * 28;
      const desktop = desktopRef.current;
      const dw = desktop?.clientWidth ?? 800;
      const dh = desktop?.clientHeight ?? 600;
      const w = Math.min(820, Math.max(420, dw - 80));
      const h = Math.min(580, Math.max(360, dh - 80));
      return [
        ...ws,
        {
          id: crypto.randomUUID(),
          name: site.name,
          url: site.url,
          letter: site.letter,
          x: 60 + offset,
          y: 36 + offset,
          w,
          h,
          z: zCounter + 1,
          minimized: false,
        },
      ];
    });
    setZCounter((z) => z + 1);
  };

  const closeExt = (id: string) =>
    setExtWindows((ws) => ws.filter((w) => w.id !== id));
  const minimizeExt = (id: string) =>
    setExtWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const updateExt = (id: string, patch: Partial<ExtWindowState>) =>
    setExtWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const visibleWindows = windows.filter((w) => !w.minimized);
  const minimizedWindows = windows.filter((w) => w.minimized);
  const visibleExt = extWindows.filter((w) => !w.minimized);
  const minimizedExt = extWindows.filter((w) => w.minimized);

  /* ---- Tab grouping (Chrome-style merge/detach) ---- */

  // Build a unified list of tabs from both window types.
  type TabItem =
    | {
        kind: "tool";
        uid: string;
        groupId: string;
        z: number;
        x: number; y: number; w: number; h: number;
        win: WindowState;
      }
    | {
        kind: "ext";
        uid: string;
        groupId: string;
        z: number;
        x: number; y: number; w: number; h: number;
        ext: ExtWindowState;
      };

  const allTabs: TabItem[] = [
    ...visibleWindows.map<TabItem>((w) => ({
      kind: "tool",
      uid: `tool:${w.key}`,
      groupId: w.groupId ?? `tool:${w.key}`,
      z: w.z, x: w.x, y: w.y, w: w.w, h: w.h,
      win: w,
    })),
    ...visibleExt.map<TabItem>((w) => ({
      kind: "ext",
      uid: `ext:${w.id}`,
      groupId: w.groupId ?? `ext:${w.id}`,
      z: w.z, x: w.x, y: w.y, w: w.w, h: w.h,
      ext: w,
    })),
  ];

  const groupsMap = new Map<string, TabItem[]>();
  for (const t of allTabs) {
    const arr = groupsMap.get(t.groupId) ?? [];
    arr.push(t);
    groupsMap.set(t.groupId, arr);
  }
  const groups = Array.from(groupsMap.entries()).map(([groupId, tabs]) => {
    const leader = tabs.reduce((a, b) => (a.z >= b.z ? a : b));
    return {
      groupId,
      tabs,
      leader,
      maxZ: leader.z,
    };
  });

  // Active tab per group — defaults to top-z member; persisted in component state.
  const [activeTabByGroup, setActiveTabByGroup] = useState<Record<string, string>>({});
  const setActive = (groupId: string, uid: string) =>
    setActiveTabByGroup((m) => ({ ...m, [groupId]: uid }));

  // Maximized groups + their saved geometry (for restore).
  const [maximizedGroups, setMaximizedGroups] = useState<
    Record<string, { x: number; y: number; w: number; h: number } | undefined>
  >({});

  const toggleGroupMaximize = (groupId: string) => {
    const desktop = desktopRef.current;
    if (!desktop) return;
    const dw = desktop.clientWidth;
    const dh = desktop.clientHeight;
    setMaximizedGroups((prev) => {
      const saved = prev[groupId];
      if (saved) {
        // restore
        setGroupGeometry(groupId, saved);
        const next = { ...prev };
        delete next[groupId];
        return next;
      }
      // maximize — save current leader geometry
      const members = groupsMap.get(groupId) ?? [];
      const lead = members.reduce((a, b) => (a.z >= b.z ? a : b), members[0]);
      const snapshot = lead ? { x: lead.x, y: lead.y, w: lead.w, h: lead.h } : { x: 60, y: 60, w: 720, h: 460 };
      setGroupGeometry(groupId, { x: 0, y: 0, w: dw, h: dh });
      return { ...prev, [groupId]: snapshot };
    });
  };

  const focusUid = (uid: string) => {
    if (uid.startsWith("tool:")) focus(uid.slice(5) as ToolKey);
    else if (uid.startsWith("ext:")) focusExt(uid.slice(4));
  };

  // Bring an entire group (all tabs) to the front.
  const focusGroup = (groupId: string) => {
    const members = groupsMap.get(groupId) ?? [];
    for (const m of members) focusUid(m.uid);
  };

  const closeUid = (uid: string) => {
    if (uid.startsWith("tool:")) closeWindow(uid.slice(5) as ToolKey);
    else if (uid.startsWith("ext:")) closeExt(uid.slice(4));
  };

  const minimizeUid = (uid: string) => {
    if (uid.startsWith("tool:")) minimizeWindow(uid.slice(5) as ToolKey);
    else if (uid.startsWith("ext:")) minimizeExt(uid.slice(4));
  };

  // Patch geometry on a uid (writes through to tool or ext store).
  const patchGeometry = (uid: string, patch: Partial<{ x: number; y: number; w: number; h: number; z: number }>) => {
    if (uid.startsWith("tool:")) updateWindow(uid.slice(5) as ToolKey, patch);
    else if (uid.startsWith("ext:")) updateExt(uid.slice(4), patch);
  };

  // Apply group geometry to ALL members so detach preserves position/size.
  const setGroupGeometry = (groupId: string, geom: Partial<{ x: number; y: number; w: number; h: number }>) => {
    const members = groupsMap.get(groupId) ?? [];
    for (const m of members) patchGeometry(m.uid, geom);
  };

  // Reassign a uid's groupId.
  const setGroupOf = (uid: string, newGroupId: string) => {
    if (uid.startsWith("tool:")) {
      const k = uid.slice(5) as ToolKey;
      setWindows((ws) => ws.map((w) => (w.key === k ? { ...w, groupId: newGroupId } : w)));
    } else if (uid.startsWith("ext:")) {
      const id = uid.slice(4);
      setExtWindows((ws) => ws.map((w) => (w.id === id ? { ...w, groupId: newGroupId } : w)));
    }
  };

  // Drop handler used by tab drag-and-drop.
  // If tab dropped on another group's strip, merge into that group (inheriting geometry).
  // If dropped outside any strip, detach into a new solo group at drop point.
  const handleTabDrop = (
    draggedUid: string,
    fromGroupId: string,
    target:
      | { kind: "merge"; toGroupId: string }
      | { kind: "detach"; x: number; y: number }
  ) => {
    if (target.kind === "merge") {
      if (target.toGroupId === fromGroupId) return;
      setGroupOf(draggedUid, target.toGroupId);
      // Inherit geometry from the destination group's leader so the moved tab
      // shows correctly when it becomes active later.
      const dest = groupsMap.get(target.toGroupId);
      if (dest && dest.length) {
        const lead = dest.reduce((a, b) => (a.z >= b.z ? a : b));
        patchGeometry(draggedUid, { x: lead.x, y: lead.y, w: lead.w, h: lead.h });
      }
      setActive(target.toGroupId, draggedUid);
      focusUid(draggedUid);
    } else {
      // Detach: only meaningful if currently in a multi-tab group
      const fromMembers = groupsMap.get(fromGroupId) ?? [];
      if (fromMembers.length <= 1) return;
      const newGid = `g:${crypto.randomUUID().slice(0, 8)}`;
      setGroupOf(draggedUid, newGid);
      patchGeometry(draggedUid, { x: target.x, y: target.y });
      focusUid(draggedUid);
    }
  };


  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="h-14 border-b border-border/60 backdrop-blur-xl bg-background/70 shrink-0 z-40">
        <div className="h-full px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-[14px] font-semibold tracking-tight">
              Agant
            </Link>
            <span className="text-border">/</span>
            <span className="text-[13px] text-muted-foreground truncate">Acme Legal</span>
          </div>
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                placeholder="Search wiki, meetings, threads…"
                className="h-8 pl-8 pr-9 text-[12px] bg-card border-border"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <MicButton
                  onTranscript={(t) => setTopSearch((v) => (v ? `${v} ${t}` : t))}
                  size="sm"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Settings">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 z-[100000]">
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Language
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Voice input & AI replies will use this language.
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {(Object.keys(LANGUAGES) as AppLanguage[]).map((code) => {
                        const meta = LANGUAGES[code];
                        const active = code === language;
                        return (
                          <button
                            key={code}
                            onClick={() => setLanguage(code)}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                              active
                                ? "bg-primary/15 text-foreground border border-primary/30"
                                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{meta.flag}</span>
                              <span>{meta.label}</span>
                            </span>
                            {active && <span className="text-[10px] text-primary">Active</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("/")}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className="ml-1 h-7 w-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[11px] font-medium text-primary">
              AS
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-[200px] shrink-0 border-r border-border/60 bg-background/40 hidden md:flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Toolkit
            </div>
            <nav className="space-y-0.5">
              {TOOLS.map((t) => {
                const Icon = t.icon;
                const win = windows.find((w) => w.key === t.key);
                const isOpen = !!win && windowMode;
                return (
                  <button
                    key={t.key}
                    onClick={() => openTool(t.key)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                      isOpen
                        ? "bg-secondary/60 text-foreground"
                        : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isOpen ? "text-primary" : ""}`} />
                    <span className="truncate flex-1 text-left">{t.name}</span>
                    {isOpen && (
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" aria-hidden />
                    )}
                  </button>
                );
              })}
            </nav>
            <InstantAccessMenu onOpen={openExternal} />
          </div>

          <div className="shrink-0 p-3 border-t border-border/60 bg-background/60 backdrop-blur-md">
            <ServerStatus />
          </div>
        </aside>

        {/* Main stage — either full-screen Home or windowed desktop */}
        <main className="flex-1 min-w-0 relative overflow-hidden" ref={desktopRef}>
          {!windowMode ? (
            // Default view: Home full-screen, just like before
            <div className="absolute inset-0 overflow-auto">
              <ToolPanel toolKey="home" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-grid" data-desktop>
              {windows.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-[13px] text-muted-foreground">
                      Window mode is on. Pick a tool from the sidebar to open it.
                    </div>
                    <div className="text-[11px] text-muted-foreground/70 mt-1">
                      Drag, resize, and stack windows side-by-side.
                    </div>
                  </div>
                </div>
              )}

              {/* Detach drops are handled by TabGroupWindow via document.elementFromPoint;
                  the parent [data-desktop] above is the implicit detach target. */}
              {groups.map((g) => {
                const tabs: GroupTab[] = g.tabs.map((t) => {
                  if (t.kind === "tool") {
                    const tool = TOOLS.find((x) => x.key === t.win.key)!;
                    return {
                      uid: t.uid, kind: "tool",
                      key: t.win.key, name: tool.name, icon: tool.icon,
                    };
                  }
                  return {
                    uid: t.uid, kind: "ext",
                    id: t.ext.id, name: t.ext.name,
                    url: t.ext.url, letter: t.ext.letter,
                  };
                });
                const activeUid = activeTabByGroup[g.groupId] ?? g.leader.uid;
                const lead = g.leader;
                return (
                  <TabGroupWindow
                    key={g.groupId}
                    groupId={g.groupId}
                    tabs={tabs}
                    activeUid={activeUid}
                    x={lead.x} y={lead.y} w={lead.w} h={lead.h} z={lead.z}
                    onSetActive={(uid) => { setActive(g.groupId, uid); focusGroup(g.groupId); focusUid(uid); }}
                    onFocus={() => focusGroup(g.groupId)}
                    onCloseTab={(uid) => closeUid(uid)}
                    onMinimize={() => g.tabs.forEach((t) => minimizeUid(t.uid))}
                    onToggleMaximize={() => toggleGroupMaximize(g.groupId)}
                    onChange={(patch) => setGroupGeometry(g.groupId, patch)}
                    onTabDrop={handleTabDrop}
                    bounds={desktopRef}
                  />
                );
              })}

              {(minimizedWindows.length > 0 || minimizedExt.length > 0) && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-xl shadow-lg">
                  {minimizedWindows.map((w) => {
                    const t = TOOLS.find((x) => x.key === w.key)!;
                    const Icon = t.icon;
                    return (
                      <button
                        key={w.key}
                        onClick={() => focus(w.key)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                      >
                        <Icon className="h-3 w-3 text-primary" />
                        <span>{t.name}</span>
                      </button>
                    );
                  })}
                  {minimizedExt.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => focusExt(w.id)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                    >
                      <span className="h-3 w-3 rounded-[3px] border border-border bg-background flex items-center justify-center text-[8px] font-semibold">
                        {w.letter}
                      </span>
                      <span>{w.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Floating bottom-right action cluster */}
          <QuickAiChat />

          <button
            onClick={() => setWindowMode((v) => !v)}
            className={`absolute bottom-4 right-4 z-50 h-11 w-11 rounded-full border shadow-lg flex items-center justify-center transition-all ${
              windowMode
                ? "bg-primary text-primary-foreground border-primary hover:brightness-110"
                : "bg-card text-foreground border-border hover:bg-secondary/60"
            }`}
            aria-label={windowMode ? "Exit window mode" : "Open tab maker"}
            title={windowMode ? "Exit window mode" : "Open tab maker"}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        </main>
      </div>
    </div>
  );
};

/* -------------------- Window editor popover -------------------- */

const WindowEditor = ({
  win,
  tool,
  onChange,
  onClose,
  bounds,
}: {
  win: WindowState;
  tool: Tool;
  onChange: (patch: Partial<WindowState>) => void;
  onClose: () => void;
  bounds: React.RefObject<HTMLDivElement>;
}) => {
  const maxW = bounds.current?.clientWidth ?? 1200;
  const maxH = bounds.current?.clientHeight ?? 800;

  return (
    <div
      style={{
        left: Math.min(win.x + win.w + 8, maxW - 240),
        top: Math.min(win.y, maxH - 280),
        zIndex: 9999,
      }}
      className="absolute w-[224px] rounded-lg border border-border bg-card shadow-2xl p-3 animate-fade-in"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {tool.name}
        </div>
        <button
          onClick={onClose}
          className="h-5 w-5 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          aria-label="Close editor"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Style */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
          Frame style
        </div>
        <div className="grid grid-cols-2 gap-1">
          {(["dark", "light"] as WindowStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ style: s })}
              className={`flex items-center justify-center gap-1.5 h-8 rounded-md border text-[11px] transition-colors ${
                win.style === s
                  ? "bg-secondary/60 border-primary/40 text-foreground"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              <span className="capitalize">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Density */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
          Density
        </div>
        <div className="grid grid-cols-2 gap-1">
          {(["compact", "cozy"] as WindowDensity[]).map((d) => (
            <button
              key={d}
              onClick={() => onChange({ density: d })}
              className={`flex items-center justify-center gap-1.5 h-8 rounded-md border text-[11px] transition-colors ${
                win.density === d
                  ? "bg-secondary/60 border-primary/40 text-foreground"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === "compact" ? <Rows3 className="h-3 w-3" /> : <Square className="h-3 w-3" />}
              <span className="capitalize">{d}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
          Size
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[11px] text-muted-foreground">
            Width
            <input
              type="number"
              value={Math.round(win.w)}
              min={320}
              max={maxW}
              onChange={(e) =>
                onChange({ w: Math.max(320, Math.min(maxW - win.x, Number(e.target.value) || 320)) })
              }
              className="mt-1 w-full h-7 px-2 rounded-md border border-border bg-background text-[12px] text-foreground"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Height
            <input
              type="number"
              value={Math.round(win.h)}
              min={220}
              max={maxH}
              onChange={(e) =>
                onChange({ h: Math.max(220, Math.min(maxH - win.y, Number(e.target.value) || 220)) })
              }
              className="mt-1 w-full h-7 px-2 rounded-md border border-border bg-background text-[12px] text-foreground"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

/* -------------------- Floating window -------------------- */

type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DragMode = { kind: "move" } | { kind: "resize"; edge: ResizeEdge };

export type SnapZone =
  | "left-half" | "right-half"
  | "left-third" | "right-third"
  | "top-left-quarter" | "top-right-quarter"
  | "bottom-left-quarter" | "bottom-right-quarter";

const MIN_W = 320;
const MIN_H = 220;

/* -------------------- TabGroupWindow (Chrome-style merged tabs) -------------------- */

type GroupTab =
  | { uid: string; kind: "tool"; key: ToolKey; name: string; icon: typeof Home }
  | { uid: string; kind: "ext"; id: string; name: string; url: string; letter: string };

const TAB_DRAG_MIME = "application/x-agant-tab";

const TabGroupWindow = ({
  groupId,
  tabs,
  activeUid,
  x, y, w, h, z,
  onSetActive,
  onFocus,
  onCloseTab,
  onMinimize,
  onToggleMaximize,
  onChange,
  onTabDrop,
  bounds,
}: {
  groupId: string;
  tabs: GroupTab[];
  activeUid: string;
  x: number; y: number; w: number; h: number; z: number;
  onSetActive: (uid: string) => void;
  onFocus: () => void;
  onCloseTab: (uid: string) => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onChange: (patch: Partial<{ x: number; y: number; w: number; h: number }>) => void;
  onTabDrop: (
    draggedUid: string,
    fromGroupId: string,
    target:
      | { kind: "merge"; toGroupId: string }
      | { kind: "detach"; x: number; y: number }
  ) => void;
  bounds: React.RefObject<HTMLDivElement>;
}) => {
  const dragRef = useRef<{
    mode: DragMode;
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
    pointerId: number; target: Element;
  } | null>(null);

  // Pointer-based tab drag (replaces fragile HTML5 DnD)
  const tabDragRef = useRef<{
    uid: string;
    pointerId: number;
    startX: number; startY: number;
    moved: boolean;
    target: Element;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const [tabGhost, setTabGhost] = useState<{ uid: string; name: string; x: number; y: number } | null>(null);

  const [iframeBlocked, setIframeBlocked] = useState<Record<string, boolean>>({});
  const iframeLoaded = useRef<Record<string, boolean>>({});

  const onMove = useCallback((e: PointerEvent | React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const c = bounds.current;
    const maxW = c?.clientWidth ?? 1200;
    const maxH = c?.clientHeight ?? 800;
    if (d.mode.kind === "move") {
      onChange({
        x: Math.max(0, Math.min(maxW - d.origW, d.origX + dx)),
        y: Math.max(0, Math.min(maxH - 32, d.origY + dy)),
      });
      return;
    }
    const edge = d.mode.edge;
    let nx = d.origX, ny = d.origY, nw = d.origW, nh = d.origH;
    if (edge.includes("e")) nw = Math.max(MIN_W, Math.min(maxW - d.origX, d.origW + dx));
    if (edge.includes("s")) nh = Math.max(MIN_H, Math.min(maxH - d.origY, d.origH + dy));
    if (edge.includes("w")) {
      const right = d.origX + d.origW;
      nx = Math.max(0, Math.min(right - MIN_W, d.origX + dx));
      nw = right - nx;
    }
    if (edge.includes("n")) {
      const bottom = d.origY + d.origH;
      ny = Math.max(0, Math.min(bottom - MIN_H, d.origY + dy));
      nh = bottom - ny;
    }
    onChange({ x: nx, y: ny, w: nw, h: nh });
  }, [bounds, onChange]);

  const onUp = useCallback((e?: PointerEvent | React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (e && e.pointerId !== d.pointerId) return;
    try {
      (d.target as Element & { releasePointerCapture: (id: number) => void })
        .releasePointerCapture(d.pointerId);
    } catch { /* noop */ }
    dragRef.current = null;
  }, []);

  // ----- Tab pointer drag handlers -----
  const onTabMove = useCallback((e: PointerEvent) => {
    const d = tabDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setTabGhost((g) => ({
      uid: d.uid,
      name: g?.name ?? "",
      x: e.clientX,
      y: e.clientY,
    }));
  }, []);

  const onTabUp = useCallback((e: PointerEvent) => {
    const d = tabDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try {
      (d.target as Element & { releasePointerCapture: (id: number) => void })
        .releasePointerCapture(d.pointerId);
    } catch { /* noop */ }
    const draggedUid = d.uid;
    const wasMoved = d.moved;
    tabDragRef.current = null;
    setTabGhost(null);
    if (!wasMoved) return; // treat as click
    suppressNextClickRef.current = true;
    // Hit test — find a strip or the desktop
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const strip = el?.closest("[data-tab-strip]") as HTMLElement | null;
    if (strip) {
      const toGroupId = strip.getAttribute("data-group-id");
      if (toGroupId) {
        onTabDrop(draggedUid, groupId, { kind: "merge", toGroupId });
        return;
      }
    }
    const desk = el?.closest("[data-desktop]") as HTMLElement | null;
    if (desk) {
      const rect = desk.getBoundingClientRect();
      const x = Math.max(0, e.clientX - rect.left - 60);
      const y = Math.max(0, e.clientY - rect.top - 16);
      onTabDrop(draggedUid, groupId, { kind: "detach", x, y });
    }
  }, [groupId, onTabDrop]);

  useEffect(() => {
    const m = (e: PointerEvent) => { onMove(e); onTabMove(e); };
    const u = (e: PointerEvent) => { onUp(e); onTabUp(e); };
    window.addEventListener("pointermove", m);
    window.addEventListener("pointerup", u);
    window.addEventListener("pointercancel", u);
    return () => {
      window.removeEventListener("pointermove", m);
      window.removeEventListener("pointerup", u);
      window.removeEventListener("pointercancel", u);
    };
  }, [onMove, onUp, onTabMove, onTabUp]);

  const startDrag = (mode: DragMode, e: React.PointerEvent) => {
    const targetEl = e.target as HTMLElement;
    if (mode.kind === "move" && targetEl.closest("button, a, input, [data-tab-handle], [data-no-drag]")) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = {
      mode,
      startX: e.clientX, startY: e.clientY,
      origX: x, origY: y, origW: w, origH: h,
      pointerId: e.pointerId, target,
    };
  };

  const startTabDrag = (uid: string, name: string, e: React.PointerEvent) => {
    // Only left-button
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch { /* noop */ }
    tabDragRef.current = {
      uid,
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      moved: false,
      target,
    };
    setTabGhost({ uid, name, x: e.clientX, y: e.clientY });
  };

  const resizeHandle = (edge: ResizeEdge, className: string, cursor: string) => (
    <div
      key={edge}
      onPointerDown={(e) => startDrag({ kind: "resize", edge }, e)}
      className={`absolute ${className} ${cursor} z-30 touch-none`}
      data-no-drag
    />
  );

  const active = tabs.find((t) => t.uid === activeUid) ?? tabs[0];

  const renderTabContent = (t: GroupTab) => {
    if (t.kind === "tool") {
      return <ToolPanel toolKey={t.key} />;
    }
    // ext (iframe)
    return (
      <div className="absolute inset-0">
        <iframe
          src={t.url}
          title={t.name}
          onLoad={() => {
            iframeLoaded.current[t.uid] = true;
            setIframeBlocked((m) => ({ ...m, [t.uid]: false }));
          }}
          className="absolute inset-0 w-full h-full bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {iframeBlocked[t.uid] && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
            <div className="max-w-sm text-center">
              <div className="text-[13px] font-medium mb-1">{t.name} blocks embedding</div>
              <div className="text-[12px] text-muted-foreground mb-4">
                This site refuses to load inside another window for security reasons.
              </div>
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] bg-primary text-primary-foreground hover:brightness-110"
              >
                <ExternalLink className="h-3 w-3" />
                Open {t.name} in a new tab
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  // After mount/active change, set a timeout to detect blocked iframes
  useEffect(() => {
    if (!active || active.kind !== "ext") return;
    const uid = active.uid;
    iframeLoaded.current[uid] = iframeLoaded.current[uid] ?? false;
    const t = window.setTimeout(() => {
      if (!iframeLoaded.current[uid]) {
        setIframeBlocked((m) => ({ ...m, [uid]: true }));
      }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [active]);

  const isExt = active?.kind === "ext";

  return (
    <div
      onMouseDown={onFocus}
      style={{ left: x, top: y, width: w, height: h, zIndex: z }}
      className="absolute rounded-lg border border-border bg-background shadow-2xl flex flex-col animate-fade-in"
    >
      {/* Title bar (drag = move window) */}
      <div
        onPointerDown={(e) => startDrag({ kind: "move" }, e)}
        onDoubleClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("button, [data-tab-handle], [data-no-drag]")) return;
          onToggleMaximize();
        }}
        className="h-9 shrink-0 flex items-center gap-2 px-2 border-b border-border/60 bg-card/80 backdrop-blur-md cursor-move select-none touch-none rounded-t-lg"
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onCloseTab(activeUid); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-3 w-3 rounded-full bg-[hsl(0,72%,60%)] hover:brightness-110"
            aria-label="Close active tab"
            title="Close tab"
            data-no-drag
          />
          <button
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-3 w-3 rounded-full bg-[hsl(40,90%,55%)] hover:brightness-110"
            aria-label="Minimize"
            title="Minimize"
            data-no-drag
          />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="h-3 w-3 rounded-full bg-[hsl(140,55%,50%)] hover:brightness-110"
            aria-label="Maximize"
            title="Maximize"
            data-no-drag
          />
        </div>

        {/* Tab strip — drop target for tab merges */}
        <div
          className={`flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-none rounded-md transition-colors ${
            tabGhost && tabGhost.uid !== activeUid ? "ring-1 ring-primary/30" : ""
          }`}
          data-no-drag
          data-tab-strip
          data-group-id={groupId}
        >
          {tabs.map((t) => {
            const isActive = t.uid === activeUid;
            return (
              <div
                key={t.uid}
                onPointerDown={(e) => startTabDrag(t.uid, t.name, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    return;
                  }
                  onSetActive(t.uid);
                  onFocus();
                }}
                data-tab-handle
                className={`group/tab relative flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11.5px] cursor-grab active:cursor-grabbing shrink-0 max-w-[180px] transition-colors touch-none ${
                  isActive
                    ? "bg-background text-foreground border border-border/80 shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
                title={t.name}
              >
                {t.kind === "tool" ? (
                  <t.icon className={`h-3 w-3 shrink-0 ${isActive ? "text-primary" : ""}`} />
                ) : (
                  <span className="h-3 w-3 shrink-0 rounded-[3px] border border-border bg-background flex items-center justify-center text-[8px] font-semibold">
                    {t.letter}
                  </span>
                )}
                <span className="truncate">{t.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onCloseTab(t.uid); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 shrink-0 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-secondary/80 hover:text-foreground opacity-60 group-hover/tab:opacity-100"
                  aria-label={`Close ${t.name}`}
                  data-no-drag
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right side: open-externally for active iframe tab */}
        {isExt && active.kind === "ext" && (
          <a
            href={active.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-5 w-5 shrink-0 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title="Open in a new tab"
            data-no-drag
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Active tab content — disable pointer events on iframes during a tab drag
          so elementFromPoint can reach the underlying strip/desktop targets. */}
      <div
        className={`flex-1 min-h-0 relative rounded-b-lg ${isExt ? "bg-background overflow-hidden" : "bg-background overflow-y-auto"}`}
        style={tabGhost ? { pointerEvents: "none" } : undefined}
      >
        {active && renderTabContent(active)}
      </div>

      {/* Resize handles */}
      <>
        {resizeHandle("n",  "top-0 left-3 right-3 h-2", "cursor-ns-resize")}
        {resizeHandle("s",  "bottom-0 left-3 right-3 h-2", "cursor-ns-resize")}
        {resizeHandle("w",  "left-0 top-3 bottom-3 w-2", "cursor-ew-resize")}
        {resizeHandle("e",  "right-0 top-3 bottom-3 w-2", "cursor-ew-resize")}
        {resizeHandle("nw", "top-0 left-0 h-3.5 w-3.5", "cursor-nwse-resize")}
        {resizeHandle("ne", "top-0 right-0 h-3.5 w-3.5", "cursor-nesw-resize")}
        {resizeHandle("sw", "bottom-0 left-0 h-3.5 w-3.5", "cursor-nesw-resize")}
        {resizeHandle("se", "bottom-0 right-0 h-3.5 w-3.5", "cursor-nwse-resize")}
      </>

      {/* Floating tab ghost (portaled to body so it sits above everything) */}
      {tabGhost && createPortal(
        <div
          style={{
            position: "fixed",
            left: tabGhost.x + 8,
            top: tabGhost.y + 8,
            zIndex: 99999,
            pointerEvents: "none",
          }}
          className="px-2.5 h-7 rounded-md text-[11.5px] bg-card text-foreground border border-border shadow-xl flex items-center gap-1.5 max-w-[200px]"
        >
          <span className="truncate">{tabGhost.name}</span>
        </div>,
        document.body
      )}
    </div>
  );
};

const focusUidNoop = () => { /* parent re-orders via onSetActive + onFocus */ };

const FloatingWindow = ({
  state,
  tool,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onChange,
  onOpenEditor,
  onSnap,
  bounds,
}: {
  state: WindowState;
  tool: Tool;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onChange: (patch: Partial<WindowState>) => void;
  onOpenEditor: () => void;
  onSnap: (zone: SnapZone) => void;
  bounds: React.RefObject<HTMLDivElement>;
}) => {
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    target: Element;
    pointerId: number;
  } | null>(null);

  const [snapMenuOpen, setSnapMenuOpen] = useState(false);
  const [snapMenuPos, setSnapMenuPos] = useState<{ left: number; top: number } | null>(null);
  const minimizeBtnRef = useRef<HTMLButtonElement>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const handlePointerMove = useCallback((event: PointerEvent | React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || event.pointerId !== d.pointerId) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    const container = bounds.current;
    const maxW = container?.clientWidth ?? 1200;
    const maxH = container?.clientHeight ?? 800;

    if (d.mode.kind === "move") {
      const x = Math.max(0, Math.min(maxW - d.origW, d.origX + dx));
      const y = Math.max(0, Math.min(maxH - 32, d.origY + dy));
      onChange({ x, y });
      return;
    }

    const edge = d.mode.edge;
    let { origX: nx, origY: ny, origW: nw, origH: nh } = d;

    if (edge.includes("e")) {
      nw = Math.max(MIN_W, Math.min(maxW - d.origX, d.origW + dx));
    }
    if (edge.includes("s")) {
      nh = Math.max(MIN_H, Math.min(maxH - d.origY, d.origH + dy));
    }
    if (edge.includes("w")) {
      const right = d.origX + d.origW;
      nx = Math.max(0, Math.min(right - MIN_W, d.origX + dx));
      nw = right - nx;
    }
    if (edge.includes("n")) {
      const bottom = d.origY + d.origH;
      ny = Math.max(0, Math.min(bottom - MIN_H, d.origY + dy));
      nh = bottom - ny;
    }

    onChange({ x: nx, y: ny, w: nw, h: nh });
  }, [bounds, onChange]);

  const handlePointerUp = useCallback((event?: PointerEvent | React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (event && event.pointerId !== d.pointerId) return;
    try {
      (d.target as Element & { releasePointerCapture: (id: number) => void })
        .releasePointerCapture(d.pointerId);
    } catch {
      /* noop */
    }
    dragRef.current = null;
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => handlePointerMove(event);
    const onUp = (event: PointerEvent) => handlePointerUp(event);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const startDrag = (mode: DragMode, e: React.PointerEvent) => {
    if (state.maximized && mode.kind === "move") return;
    const targetEl = e.target as HTMLElement;
    if (mode.kind === "move" && targetEl.closest("button, input, a, [data-no-drag]")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: state.x,
      origY: state.y,
      origW: state.w,
      origH: state.h,
      target,
      pointerId: e.pointerId,
    };
  };

  const Icon = tool.icon;
  const isLight = state.style === "light";
  const titleBarH = state.density === "compact" ? "h-7" : "h-9";
  const contentPad = state.density === "compact" ? "text-[12px]" : "";

  const resizeHandle = (edge: ResizeEdge, className: string, cursor: string) => (
    <div
      key={edge}
      onPointerDown={(e) => startDrag({ kind: "resize", edge }, e)}
      className={`absolute ${className} ${cursor} z-30 touch-none`}
      aria-label={`Resize ${edge}`}
      data-no-drag
    />
  );

  // Snap menu hover handlers — open after 600ms hover on minimize button
  const openSnapMenu = () => {
    const btn = minimizeBtnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      setSnapMenuPos({ left: r.left, top: r.bottom + 8 });
    }
    setSnapMenuOpen(true);
  };
  const onMinimizeEnter = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(openSnapMenu, 600);
  };
  const onMinimizeLeave = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
  };
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return (
    <div
      onMouseDown={onFocus}
      style={{
        left: state.x,
        top: state.y,
        width: state.w,
        height: state.h,
        zIndex: state.z,
      }}
      className={`absolute rounded-lg border shadow-2xl flex flex-col animate-fade-in ${
        isLight ? "border-border bg-white text-zinc-900" : "border-border bg-background"
      }`}
    >
      {/* Title bar — drag handle */}
      <div
        onPointerDown={(e) => startDrag({ kind: "move" }, e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={onToggleMaximize}
        className={`${titleBarH} shrink-0 flex items-center gap-2 px-3 border-b cursor-move select-none touch-none rounded-t-lg ${
          isLight
            ? "border-zinc-200 bg-zinc-100/90 backdrop-blur-md"
            : "border-border/60 bg-card/80 backdrop-blur-md"
        }`}
      >
        <div className="flex items-center gap-1.5 relative">
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-3 w-3 rounded-full bg-[hsl(0,72%,60%)] hover:brightness-110"
            aria-label="Close"
            data-no-drag
          />
          <button
            ref={minimizeBtnRef}
            onClick={(e) => { e.stopPropagation(); onMinimize(); setSnapMenuOpen(false); }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseEnter={onMinimizeEnter}
            onMouseLeave={onMinimizeLeave}
            className="h-3 w-3 rounded-full bg-[hsl(40,90%,55%)] hover:brightness-110"
            aria-label="Minimize (hover for split layouts)"
            data-no-drag
          />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-3 w-3 rounded-full bg-[hsl(140,55%,50%)] hover:brightness-110"
            aria-label="Maximize"
            data-no-drag
          />

          {/* Snap layout popover — portaled so it renders above all windows */}
          {snapMenuOpen && snapMenuPos && createPortal(
            <div
              onMouseEnter={() => setSnapMenuOpen(true)}
              onMouseLeave={() => setSnapMenuOpen(false)}
              onPointerDown={(e) => e.stopPropagation()}
              data-no-drag
              style={{ position: "fixed", left: snapMenuPos.left, top: snapMenuPos.top, zIndex: 9999 }}
              className="w-[200px] rounded-md border border-border bg-popover text-popover-foreground shadow-xl p-2 animate-fade-in"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground px-1 pb-1.5">
                Snap to layout
              </div>

              <div className="text-[10px] text-muted-foreground px-1 mt-1">Halves</div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <SnapBtn label="Left ½" onClick={() => { onSnap("left-half"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[true, false]]} />
                </SnapBtn>
                <SnapBtn label="Right ½" onClick={() => { onSnap("right-half"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[false, true]]} />
                </SnapBtn>
              </div>

              <div className="text-[10px] text-muted-foreground px-1 mt-2">Thirds</div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <SnapBtn label="Left ⅓" onClick={() => { onSnap("left-third"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[true, false, false]]} />
                </SnapBtn>
                <SnapBtn label="Right ⅓" onClick={() => { onSnap("right-third"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[false, false, true]]} />
                </SnapBtn>
              </div>

              <div className="text-[10px] text-muted-foreground px-1 mt-2">Quarters</div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <SnapBtn label="Top-L ¼" onClick={() => { onSnap("top-left-quarter"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[true, false], [false, false]]} />
                </SnapBtn>
                <SnapBtn label="Top-R ¼" onClick={() => { onSnap("top-right-quarter"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[false, true], [false, false]]} />
                </SnapBtn>
                <SnapBtn label="Bot-L ¼" onClick={() => { onSnap("bottom-left-quarter"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[false, false], [true, false]]} />
                </SnapBtn>
                <SnapBtn label="Bot-R ¼" onClick={() => { onSnap("bottom-right-quarter"); setSnapMenuOpen(false); }}>
                  <SnapPreview cells={[[false, false], [false, true]]} />
                </SnapBtn>
              </div>
            </div>,
            document.body
          )}
        </div>
        <div
          className={`flex items-center gap-1.5 mx-auto text-[12px] pointer-events-none ${
            isLight ? "text-zinc-600" : "text-muted-foreground"
          }`}
        >
          <Icon className="h-3 w-3 text-primary" />
          <span>{tool.name}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenEditor(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`h-5 w-5 rounded-sm flex items-center justify-center transition-colors ${
            isLight
              ? "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
          aria-label="Edit window"
          title="Edit this window"
          data-no-drag
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>

      <div className={`flex-1 min-h-0 overflow-auto rounded-b-lg ${isLight ? "bg-white" : "bg-background"} ${contentPad}`}>
        <ToolPanel toolKey={state.key} />
      </div>

      {/* 8 resize handles — sit INSIDE the container so overflow-hidden doesn't clip them */}
      {!state.maximized && (
        <>
          {resizeHandle("n",  "top-0 left-3 right-3 h-2", "cursor-ns-resize")}
          {resizeHandle("s",  "bottom-0 left-3 right-3 h-2", "cursor-ns-resize")}
          {resizeHandle("w",  "left-0 top-3 bottom-3 w-2", "cursor-ew-resize")}
          {resizeHandle("e",  "right-0 top-3 bottom-3 w-2", "cursor-ew-resize")}
          {resizeHandle("nw", "top-0 left-0 h-3.5 w-3.5", "cursor-nwse-resize")}
          {resizeHandle("ne", "top-0 right-0 h-3.5 w-3.5", "cursor-nesw-resize")}
          {resizeHandle("sw", "bottom-0 left-0 h-3.5 w-3.5", "cursor-nesw-resize")}
          {resizeHandle("se", "bottom-0 right-0 h-3.5 w-3.5", "cursor-nwse-resize")}
        </>
      )}
    </div>
  );
};

/* -------------------- External (iframe) floating window -------------------- */

const ExtFloatingWindow = ({
  state,
  onFocus,
  onClose,
  onMinimize,
  onChange,
  bounds,
}: {
  state: ExtWindowState;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onChange: (patch: Partial<ExtWindowState>) => void;
  bounds: React.RefObject<HTMLDivElement>;
}) => {
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    pointerId: number;
    target: Element;
  } | null>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const loadedRef = useRef(false);

  // If the iframe never fires `load` (X-Frame-Options/CSP block), surface a fallback
  useEffect(() => {
    loadedRef.current = false;
    setIframeBlocked(false);
    const t = window.setTimeout(() => {
      if (!loadedRef.current) setIframeBlocked(true);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [state.url]);

  const onMove = useCallback((e: PointerEvent | React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const c = bounds.current;
    const maxW = c?.clientWidth ?? 1200;
    const maxH = c?.clientHeight ?? 800;
    if (d.mode.kind === "move") {
      onChange({
        x: Math.max(0, Math.min(maxW - d.origW, d.origX + dx)),
        y: Math.max(0, Math.min(maxH - 32, d.origY + dy)),
      });
      return;
    }
    const edge = d.mode.edge;
    let nx = d.origX, ny = d.origY, nw = d.origW, nh = d.origH;
    if (edge.includes("e")) nw = Math.max(MIN_W, Math.min(maxW - d.origX, d.origW + dx));
    if (edge.includes("s")) nh = Math.max(MIN_H, Math.min(maxH - d.origY, d.origH + dy));
    if (edge.includes("w")) {
      const right = d.origX + d.origW;
      nx = Math.max(0, Math.min(right - MIN_W, d.origX + dx));
      nw = right - nx;
    }
    if (edge.includes("n")) {
      const bottom = d.origY + d.origH;
      ny = Math.max(0, Math.min(bottom - MIN_H, d.origY + dy));
      nh = bottom - ny;
    }
    onChange({ x: nx, y: ny, w: nw, h: nh });
  }, [bounds, onChange]);

  const onUp = useCallback((e?: PointerEvent | React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (e && e.pointerId !== d.pointerId) return;
    try {
      (d.target as Element & { releasePointerCapture: (id: number) => void })
        .releasePointerCapture(d.pointerId);
    } catch { /* noop */ }
    dragRef.current = null;
  }, []);

  useEffect(() => {
    const m = (e: PointerEvent) => onMove(e);
    const u = (e: PointerEvent) => onUp(e);
    window.addEventListener("pointermove", m);
    window.addEventListener("pointerup", u);
    window.addEventListener("pointercancel", u);
    return () => {
      window.removeEventListener("pointermove", m);
      window.removeEventListener("pointerup", u);
      window.removeEventListener("pointercancel", u);
    };
  }, [onMove, onUp]);

  const startDrag = (mode: DragMode, e: React.PointerEvent) => {
    const targetEl = e.target as HTMLElement;
    if (mode.kind === "move" && targetEl.closest("button, a, input, [data-no-drag]")) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: state.x,
      origY: state.y,
      origW: state.w,
      origH: state.h,
      pointerId: e.pointerId,
      target,
    };
  };

  const resizeHandle = (edge: ResizeEdge, className: string, cursor: string) => (
    <div
      key={edge}
      onPointerDown={(e) => startDrag({ kind: "resize", edge }, e)}
      className={`absolute ${className} ${cursor} z-30 touch-none`}
      data-no-drag
    />
  );

  return (
    <div
      onMouseDown={onFocus}
      style={{ left: state.x, top: state.y, width: state.w, height: state.h, zIndex: state.z }}
      className="absolute rounded-lg border border-border bg-background shadow-2xl flex flex-col animate-fade-in"
    >
      <div
        onPointerDown={(e) => startDrag({ kind: "move" }, e)}
        className="h-9 shrink-0 flex items-center gap-2 px-3 border-b border-border/60 bg-card/80 backdrop-blur-md cursor-move select-none touch-none rounded-t-lg"
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-3 w-3 rounded-full bg-[hsl(0,72%,60%)] hover:brightness-110"
            aria-label="Close"
            data-no-drag
          />
          <button
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-3 w-3 rounded-full bg-[hsl(40,90%,55%)] hover:brightness-110"
            aria-label="Minimize"
            data-no-drag
          />
          <span className="h-3 w-3 rounded-full bg-muted/40" aria-hidden />
        </div>
        <div className="flex items-center gap-1.5 mx-auto text-[12px] text-muted-foreground pointer-events-none">
          <span className="h-3.5 w-3.5 rounded-[3px] border border-border bg-background flex items-center justify-center text-[9px] font-semibold">
            {state.letter}
          </span>
          <span>{state.name}</span>
        </div>
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          title="Open in a new tab"
          data-no-drag
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex-1 min-h-0 relative bg-background rounded-b-lg overflow-hidden">
        <iframe
          src={state.url}
          title={state.name}
          onLoad={() => { loadedRef.current = true; setIframeBlocked(false); }}
          className="absolute inset-0 w-full h-full bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {iframeBlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
            <div className="max-w-sm text-center">
              <div className="text-[13px] font-medium mb-1">{state.name} blocks embedding</div>
              <div className="text-[12px] text-muted-foreground mb-4">
                This site refuses to load inside another window for security reasons.
              </div>
              <a
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] bg-primary text-primary-foreground hover:brightness-110"
              >
                <ExternalLink className="h-3 w-3" />
                Open {state.name} in a new tab
              </a>
            </div>
          </div>
        )}
      </div>

      <>
        {resizeHandle("n",  "top-0 left-3 right-3 h-2", "cursor-ns-resize")}
        {resizeHandle("s",  "bottom-0 left-3 right-3 h-2", "cursor-ns-resize")}
        {resizeHandle("w",  "left-0 top-3 bottom-3 w-2", "cursor-ew-resize")}
        {resizeHandle("e",  "right-0 top-3 bottom-3 w-2", "cursor-ew-resize")}
        {resizeHandle("nw", "top-0 left-0 h-3.5 w-3.5", "cursor-nwse-resize")}
        {resizeHandle("ne", "top-0 right-0 h-3.5 w-3.5", "cursor-nesw-resize")}
        {resizeHandle("sw", "bottom-0 left-0 h-3.5 w-3.5", "cursor-nesw-resize")}
        {resizeHandle("se", "bottom-0 right-0 h-3.5 w-3.5", "cursor-nwse-resize")}
      </>
    </div>
  );
};

/* Tiny preview swatch for the snap menu */
const SnapPreview = ({ cells }: { cells: boolean[][] }) => {
  const rows = cells.length;
  const cols = cells[0].length;
  return (
    <div
      className="w-7 h-5 rounded-sm border border-border overflow-hidden grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
      aria-hidden
    >
      {cells.flatMap((row, r) =>
        row.map((on, c) => (
          <div
            key={`${r}-${c}`}
            className={on ? "bg-primary" : "bg-muted/40"}
          />
        ))
      )}
    </div>
  );
};

const SnapBtn = ({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-1.5 py-1 rounded-md text-[11px] text-foreground hover:bg-secondary/60 transition-colors"
  >
    {children}
    <span className="truncate">{label}</span>
  </button>
);

/* -------------------- Tool Panels -------------------- */

const ToolPanel = ({ toolKey }: { toolKey: ToolKey }) => {
  switch (toolKey) {
    case "home": return <HomePanel />;
    case "vault": return <VaultPanel />;
    case "forecaster": return <ForecasterPanel />;
    case "email": return <EmailPanel />;
    case "knowledge": return <KnowledgePanel />;
    case "meeting": return <MeetingPanel />;
    case "workflows": return <WorkflowsPanel />;
    case "reports": return <ReportsPanel />;
  }
};

const PageHeader = ({ title, sub }: { title: string; sub: string }) => (
  <div className="mb-8">
    <h1 className="text-2xl md:text-[28px] font-semibold tracking-[-0.02em]">{title}</h1>
    <p className="mt-1.5 text-[13px] text-muted-foreground">{sub}</p>
  </div>
);

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
  </div>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
    {children}
  </div>
);

/* Wiki */
const VaultPanel = () => (
  <div className="px-6 md:px-10 py-8 max-w-6xl">
    <PageHeader
      title="Wiki"
      sub="Your firm's internal knowledge base — playbooks, precedents, processes. Fully on-prem."
    />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      <Stat label="Articles" value="1,284" hint="+18 this week" />
      <Stat label="Contributors" value="42" hint="Across 6 teams" />
      <Stat label="Last edit" value="14 min ago" hint="Henderson playbook" />
      <Stat label="Linked from cases" value="312" hint="AI-suggested refs" />
    </div>
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="text-[13px] font-medium">Recent activity</div>
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="px-4">
        {[
          ["Contract_Henderson_v4.pdf", "Indexed · 2 min ago"],
          ["Meeting_2026-04-17.transcript", "Encrypted · 14 min ago"],
          ["Discovery_batch_A.zip", "Stored · 1 hr ago"],
          ["Email_thread_#8821", "Summarized · 3 hr ago"],
        ].map(([name, meta]) => (
          <Row key={name}>
            <div className="min-w-0">
              <div className="text-[13px] truncate">{name}</div>
              <div className="text-[11px] text-muted-foreground">{meta}</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Row>
        ))}
      </div>
    </div>
  </div>
);

/* Forecaster */
const ForecasterPanel = () => (
  <div className="px-6 md:px-10 py-8 max-w-6xl">
    <PageHeader
      title="Forecaster"
      sub="Predicted outcomes from your sales history, past launches, and market trends."
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13px] font-medium">Q3 Launch — Verdict</div>
            <div className="text-[11px] text-muted-foreground">Updated 6 min ago</div>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
            Recommend: Release
          </span>
        </div>
        <div className="h-32 rounded-md bg-grid border border-border/40 relative overflow-hidden">
          <svg viewBox="0 0 400 120" className="w-full h-full">
            <path
              d="M0,90 L50,80 L100,72 L150,60 L200,55 L250,42 L300,38 L350,28 L400,22"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
            <path
              d="M0,90 L50,80 L100,72 L150,60 L200,55 L250,42 L300,38 L350,28 L400,22 L400,120 L0,120 Z"
              fill="hsl(var(--primary) / 0.15)"
            />
          </svg>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <div>
            <div className="text-[11px] text-muted-foreground">Probability</div>
            <div className="text-lg font-semibold mt-0.5">78%</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Confidence</div>
            <div className="text-lg font-semibold mt-0.5">High</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Est. impact</div>
            <div className="text-lg font-semibold mt-0.5">+$1.4M</div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="text-[13px] font-medium mb-3">Top drivers</div>
        <ul className="space-y-3 text-[12px]">
          {[
            ["Past launches in Q3", "+18%"],
            ["Sector tailwind", "+9%"],
            ["Pipeline coverage", "+6%"],
            ["Competitor delay", "+4%"],
            ["Margin pressure", "−3%"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-center justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

/* Email */
const EmailPanel = () => (
  <div className="px-6 md:px-10 py-8 max-w-5xl">
    <PageHeader title="Email Summarizer" sub="Triaged in seconds. Drafts in your voice." />
    <div className="rounded-lg border border-border bg-card divide-y divide-border/60">
      {[
        { from: "Henderson Counsel", subj: "Re: Contract amendment §4.2", urgency: "High", hint: "Draft ready · 2 min" },
        { from: "Internal · Partners", subj: "Quarterly partner sync — agenda", urgency: "Medium", hint: "Summarized · 1 line" },
        { from: "Westview Holdings", subj: "Discovery timeline confirmation", urgency: "High", hint: "Awaiting your reply" },
        { from: "Calendly", subj: "New booking — Tue 3:00pm", urgency: "Low", hint: "Auto-archived" },
      ].map((m) => (
        <div key={m.subj} className="px-4 py-3 flex items-center gap-4 hover:bg-secondary/30 cursor-pointer">
          <span
            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              m.urgency === "High"
                ? "border-primary/40 text-primary bg-primary/10"
                : m.urgency === "Medium"
                ? "border-border text-foreground/70"
                : "border-border text-muted-foreground"
            }`}
          >
            {m.urgency}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium truncate">{m.subj}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {m.from} · {m.hint}
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]">
            Open
          </Button>
        </div>
      ))}
    </div>
  </div>
);

/* Knowledge */
const KnowledgePanel = () => (
  <div className="px-6 md:px-10 py-8 max-w-5xl">
    <PageHeader title="Custom Knowledge" sub="Continuously trained on your firm's data. Improves overnight." />
    <div className="rounded-lg border border-border bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-medium">Live fine-tuning</div>
        <div className="flex items-center gap-2 text-[11px] text-primary">
          <Activity className="h-3 w-3 animate-pulse-dot" />
          Training in progress
        </div>
      </div>
      <div className="space-y-3 text-[12px]">
        {[
          ["Email corpus", 92],
          ["Meeting transcripts", 78],
          ["Contracts & filings", 86],
          ["Past decisions", 64],
        ].map(([k, v]) => (
          <div key={k as string}>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-foreground">{v}%</span>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-[13px] font-medium mb-2">Recent improvements</div>
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        Model now recognizes 28 new client-specific terms from this week's emails and
        recalls the Henderson §4.2 precedent automatically when drafting amendments.
      </p>
    </div>
  </div>
);

/* Meeting Copilot */
const MeetingPanel = () => (
  <div className="px-6 md:px-10 py-8 max-w-6xl">
    <PageHeader
      title="Meeting Copilot"
      sub="An employee in every meeting. Suggests, recalls, and forecasts in real time."
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
            <span className="text-[12px] text-muted-foreground">Live · Partner sync</span>
          </div>
          <span className="text-[11px] text-muted-foreground">12:34</span>
        </div>
        <div className="space-y-3 text-[13px]">
          <div className="text-muted-foreground">
            <span className="text-foreground font-medium">Sarah:</span> We should push the
            Henderson launch to Q4 — the team's stretched.
          </div>
          <div className="text-muted-foreground">
            <span className="text-foreground font-medium">Marcus:</span> Or we trim scope and
            hold Q3?
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 mt-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-primary mb-1.5">
              Copilot suggestion
            </div>
            <div className="text-[12px] leading-relaxed">
              Mention: in 2024, a similar Q3→Q4 delay cost ~$420K in client churn.
              Forecaster currently rates a trimmed Q3 release at <span className="text-primary font-medium">78% success</span>.
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="text-[13px] font-medium mb-3">Recall</div>
        <ul className="space-y-2.5 text-[12px]">
          {[
            "Henderson contract §4.2 — amended Mar 2026",
            "2024 Q4 delay → −$420K churn",
            "Pipeline coverage: 2.3x for Q3",
            "Marcus flagged scope risk on Apr 8",
          ].map((s) => (
            <li key={s} className="text-muted-foreground hover:text-foreground cursor-pointer">
              · {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

/* Workflows */
const WorkflowsPanel = () => (
  <div className="px-6 md:px-10 py-8 max-w-5xl">
    <PageHeader title="Auto Workflows" sub="Multi-step actions across the tools you already use." />
    <div className="rounded-lg border border-border bg-card divide-y divide-border/60">
      {[
        { name: "New client → vault folder + intake email", runs: "42 runs", on: true },
        { name: "Meeting end → insight report + Slack post", runs: "118 runs", on: true },
        { name: "Contract signed → CRM update + calendar follow-up", runs: "27 runs", on: true },
        { name: "Forecast shift > 10% → notify partners", runs: "6 runs", on: false },
      ].map((w) => (
        <div key={w.name} className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{w.name}</div>
            <div className="text-[11px] text-muted-foreground">{w.runs} · last 30 days</div>
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              w.on
                ? "border-primary/40 text-primary bg-primary/10"
                : "border-border text-muted-foreground"
            }`}
          >
            {w.on ? "On" : "Paused"}
          </span>
        </div>
      ))}
    </div>
  </div>
);

/* Reports */
const ReportsPanel = () => (
  <div className="px-6 md:px-10 py-8 max-w-5xl">
    <PageHeader
      title="Insight Reports"
      sub="Generated on demand, after meetings, or whenever a key metric shifts."
    />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[
        { t: "Post-meeting · Partner sync", best: "Trim Henderson scope, hold Q3", impact: "+$1.4M" },
        { t: "Threshold · Pipeline coverage", best: "Reassign 2 reps to enterprise", impact: "+$620K" },
        { t: "On-demand · Client churn risk", best: "Schedule QBR with Westview this week", impact: "Retain $480K" },
        { t: "Post-meeting · Strategy offsite", best: "Pause auto-renewal pricing change", impact: "Avoid −$210K" },
      ].map((r) => (
        <div key={r.t} className="rounded-lg border border-border bg-card p-5 hover:bg-secondary/30 cursor-pointer transition-colors">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">{r.t}</div>
          <div className="text-[14px] font-medium leading-snug">Best next move</div>
          <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{r.best}</div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
              Impact {r.impact}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* Integrations — toggleable data sources */
const INTEGRATIONS = [
  { key: "gmail", name: "Gmail", desc: "Inbox & threads", color: "from-red-500/20 to-red-500/5", letter: "G", connected: true },
  { key: "outlook", name: "Outlook", desc: "Mail & calendar", color: "from-blue-500/20 to-blue-500/5", letter: "O", connected: false },
  { key: "schoology", name: "Schoology", desc: "Courses & assignments", color: "from-sky-500/20 to-sky-500/5", letter: "S", connected: true },
  { key: "slack", name: "Slack", desc: "Channels & DMs", color: "from-fuchsia-500/20 to-fuchsia-500/5", letter: "#", connected: true },
  { key: "calendar", name: "Calendar", desc: "Meetings & events", color: "from-emerald-500/20 to-emerald-500/5", letter: "C", connected: true },
  { key: "drive", name: "Drive", desc: "Docs & files", color: "from-amber-500/20 to-amber-500/5", letter: "D", connected: false },
];

const IntegrationsStrip = () => {
  const [sources, setSources] = useState(
    Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i.connected]))
  );
  const activeCount = Object.values(sources).filter(Boolean).length;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card/70 backdrop-blur-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-medium">Your sources</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Tag what Agant can read — answers and events pull from these.
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em] text-primary">
          {activeCount} connected
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {INTEGRATIONS.map((i) => {
          const on = sources[i.key];
          return (
            <button
              key={i.key}
              onClick={() => setSources((s) => ({ ...s, [i.key]: !s[i.key] }))}
              className={`group relative text-left rounded-lg border p-2.5 transition-all ${
                on
                  ? "border-primary/40 bg-background/60"
                  : "border-border bg-background/30 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-7 w-7 shrink-0 rounded-md border border-border bg-gradient-to-br ${i.color} flex items-center justify-center text-[12px] font-semibold ${
                    on ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {i.letter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[12px] font-medium truncate ${on ? "" : "text-muted-foreground"}`}>
                    {i.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{i.desc}</div>
                </div>
                <div
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    on ? "bg-primary animate-pulse-dot" : "bg-muted"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* At-a-glance: 3 compact metric cards with switchable metrics (lawyer-focused) */
type GlanceMetric = {
  key: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  icon: typeof Gavel;
};

const GLANCE_METRICS: GlanceMetric[] = [
  { key: "cases",      label: "Cases this week",     value: "12",  delta: "+3 vs last week", trend: "up",   icon: Briefcase },
  { key: "deadlines",  label: "Deadlines to meet",   value: "5",   delta: "2 within 48h",    trend: "down", icon: Clock },
  { key: "emails",     label: "Unread emails",       value: "27",  delta: "8 flagged",       trend: "flat", icon: Mail },
  { key: "billable",   label: "Billable hours",      value: "31.5", delta: "+4.2 today",     trend: "up",   icon: Scale },
  { key: "clients",    label: "Active clients",      value: "18",  delta: "+1 this week",    trend: "up",   icon: Users },
  { key: "documents",  label: "Docs awaiting review",value: "9",   delta: "3 urgent",        trend: "down", icon: FileText },
  { key: "hearings",   label: "Hearings scheduled",  value: "4",   delta: "Next: Tue 9:30",  trend: "flat", icon: Gavel },
  { key: "filings",    label: "Filings due",         value: "6",   delta: "1 overdue",       trend: "down", icon: AlertCircle },
  { key: "consults",   label: "Consults this week",  value: "7",   delta: "+2 vs last week", trend: "up",   icon: CalendarDays },
];

const GlanceCard = ({ initial }: { initial: string }) => {
  const [metricKey, setMetricKey] = useState(initial);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const metric = GLANCE_METRICS.find((m) => m.key === metricKey) ?? GLANCE_METRICS[0];
  const Icon = metric.icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = () => {
    if (!open) {
      const card = wrapRef.current;
      if (card) {
        const r = card.getBoundingClientRect();
        const width = 200;
        setMenuPos({ left: r.right - width, top: r.bottom + 4, width });
      }
    }
    setOpen((v) => !v);
  };

  const trendColor =
    metric.trend === "up" ? "text-emerald-500"
    : metric.trend === "down" ? "text-amber-500"
    : "text-muted-foreground";

  return (
    <div ref={wrapRef} className="relative rounded-lg border border-border bg-card/70 backdrop-blur-md px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <Icon className="h-3 w-3 text-primary" />
          <span className="truncate">{metric.label}</span>
        </div>
        <button
          onClick={toggle}
          className="h-5 w-5 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
          aria-label="Change metric"
          aria-expanded={open}
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tracking-[-0.02em]">{metric.value}</span>
        <span className={`text-[10px] ${trendColor} truncate`}>{metric.delta}</span>
      </div>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", left: menuPos.left, top: menuPos.top, width: menuPos.width, zIndex: 9999 }}
          className="rounded-md border border-border bg-popover shadow-lg p-1 animate-fade-in"
        >
          {GLANCE_METRICS.map((m) => {
            const MIcon = m.icon;
            const active = m.key === metric.key;
            return (
              <button
                key={m.key}
                onClick={() => { setMetricKey(m.key); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[12px] text-left transition-colors ${
                  active ? "bg-secondary/60 text-foreground" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <MIcon className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

const AtAGlanceStrip = () => (
  <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fade-in">
    <GlanceCard initial="cases" />
    <GlanceCard initial="deadlines" />
    <GlanceCard initial="emails" />
  </div>
);

/* Home — greeting + chat + events */
const HomePanel = () => {
  const [homeAsk, setHomeAsk] = useState("");
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const events = [
    { tag: "Industry", title: "EU AI Act enforcement begins for high-risk systems", time: "2h ago" },
    { tag: "Client", title: "Henderson Counsel published a new amendment template", time: "5h ago" },
    { tag: "Market", title: "Westview Holdings filed Q1 earnings — beat by 12%", time: "Yesterday" },
    { tag: "Internal", title: "Meeting transcript indexed: Partner sync (Apr 17)", time: "Yesterday" },
  ];

  return (
    <div className="relative min-h-full">
      {/* Company logo backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-no-repeat bg-center bg-cover opacity-[0.18]"
        style={{ backgroundImage: `url(${logoBg})` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%), linear-gradient(180deg, transparent 60%, hsl(var(--background)) 100%)",
        }}
      />

      <div className="relative px-6 md:px-10 py-10 max-w-7xl mx-auto">
        {/* Greeting */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em]">
            Good {partOfDay}, <span className="text-primary">Alsu</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Here's what's new across your sources and the world they operate in.
          </p>
        </div>

        {/* At-a-glance metrics — lawyer focused */}
        <AtAGlanceStrip />

        {/* Integrations — tag the sources Agant pulls from */}
        <IntegrationsStrip />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Chat / Ask Agant */}
          <div className="rounded-xl border border-border bg-card/70 backdrop-blur-md flex flex-col min-h-[460px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px] font-medium">Ask Agant</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Private · On-prem
              </span>
            </div>

            <div className="flex-1 px-5 py-6 space-y-5 overflow-y-auto">
              <div className="max-w-[85%]">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                  Agant
                </div>
                <div className="rounded-lg rounded-tl-sm border border-border bg-background/60 px-3.5 py-2.5 text-[13px] leading-relaxed">
                  Morning. You have <span className="text-foreground font-medium">3 high-priority threads</span>,
                  one upcoming meeting at 11:00, and a draft amendment ready for the Henderson matter.
                  Where would you like to start?
                </div>
              </div>

              <div className="max-w-[85%] ml-auto text-right">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                  You
                </div>
                <div className="inline-block rounded-lg rounded-tr-sm bg-primary/15 border border-primary/30 px-3.5 py-2.5 text-[13px] text-left">
                  Summarize the Henderson thread and pull §4.2 precedent.
                </div>
              </div>

              <div className="max-w-[85%]">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                  Agant
                </div>
                <div className="rounded-lg rounded-tl-sm border border-border bg-background/60 px-3.5 py-2.5 text-[13px] leading-relaxed space-y-2">
                  <p>
                    Henderson Counsel proposed an amendment to <span className="text-primary">§4.2</span> narrowing
                    the indemnity scope. Two open questions remain on cap and survival period.
                  </p>
                  <p className="text-muted-foreground text-[12px]">
                    Precedent: Westview 2024 — accepted a 24-month survival with $2M cap. Draft ready in Vault.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-border/60">
              <div className="relative">
                <Input
                  value={homeAsk}
                  onChange={(e) => setHomeAsk(e.target.value)}
                  placeholder="Ask about anything in your firm…"
                  className="h-11 pr-32 bg-background/60 border-border text-[13px]"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <MicButton
                    onTranscript={(t) => setHomeAsk((v) => (v ? `${v} ${t}` : t))}
                    size="md"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 text-[12px]"
                  >
                    Send
                    <Send className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Today's priorities", "Draft a reply", "Forecast Q3", "Brief me on Westview"].map((s) => (
                  <button
                    key={s}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Events / News */}
          <div className="rounded-xl border border-border bg-card/70 backdrop-blur-md flex flex-col min-h-[460px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px] font-medium">Events & Signal</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Live
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {events.map((e) => (
                <button
                  key={e.title}
                  className="w-full text-left px-4 py-3.5 hover:bg-secondary/30 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {e.tag}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{e.time}</span>
                  </div>
                  <div className="text-[13px] leading-snug group-hover:text-primary transition-colors">
                    {e.title}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-border/60">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-[12px] text-muted-foreground hover:text-foreground"
              >
                View all signal
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
