import { useState, useEffect, useMemo } from "react";
import { Send, Bot, Scale, Loader2, X, Minus, Maximize2, ChevronDown, Code2, Shield, Calendar, FileText, AlertTriangle, TrendingUp, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Msg = { role: "user" | "ai"; text: string };
type RoleKey = "lawyer" | "software" | "insurance";

type RoleConfig = {
  label: string;
  icon: typeof Scale;
  greeting: string;
  suggestions: string[];
  scripted: Record<string, string>;
  events: { icon: typeof FileText; tag: string; title: string; minutesAgo: number }[];
  eventsTitle: string;
};

const ROLES: Record<RoleKey, RoleConfig> = {
  lawyer: {
    label: "Lawyer",
    icon: Scale,
    greeting: "{timeGreeting} Counsel — I've indexed 1,247 emails and 38 meetings from the past month. What would you like to know?",
    suggestions: [
      "Summarize the Smith case emails",
      "What did I miss in yesterday's meeting",
      "Draft a reply to the Johnson contract",
    ],
    scripted: {
      "summarize the smith case emails":
        "📩 12 emails from the Smith matter (last 7 days). Opposing counsel proposed mediation Mar 14, client wants a counter-offer above $85K, deposition rescheduled to Mar 22 at 10am.",
      "what did i miss in yesterday's meeting":
        "🎙️ Partner sync (47 min). Decisions: take Reyes pro-bono, defer hiring until Q3. Action items: draft retainer for Acme by Friday, review Lin contract.",
      "draft a reply to the johnson contract":
        "✍️ Draft ready. Tone: firm but collaborative. Highlights the 3 clauses you flagged (indemnity, IP assignment, termination) and proposes revised language.",
    },
    eventsTitle: "Legal Events",
    events: [
      { icon: AlertTriangle, tag: "Filing", title: "Smith v. Acme — response deadline in 3 days", minutesAgo: 12 },
      { icon: Calendar, tag: "Hearing", title: "Reyes deposition rescheduled to Mar 22, 10:00 AM", minutesAgo: 47 },
      { icon: FileText, tag: "Ruling", title: "9th Circuit issues opinion on AI evidence admissibility", minutesAgo: 124 },
      { icon: Mail, tag: "Email", title: "Johnson Corp counsel sent revised contract draft", minutesAgo: 198 },
    ],
  },
  software: {
    label: "Software Developer",
    icon: Code2,
    greeting: "{timeGreeting} — I've indexed 312 PRs, 1,840 Slack threads, and yesterday's standups. What's on your mind?",
    suggestions: [
      "Summarize last night's incident",
      "What's blocking the auth migration",
      "Draft the sprint review notes",
    ],
    scripted: {
      "summarize last night's incident":
        "🚨 P1 at 02:14 UTC — checkout API 503s for 18 min. Root cause: Redis connection pool exhausted after deploy #4821. Mitigated by rollback. Postmortem owner: @priya.",
      "what's blocking the auth migration":
        "🔒 3 blockers: (1) SAML test tenant not provisioned, (2) waiting on legal review of session-token TTL, (3) rate-limit middleware needs refactor. ETA slips 4 days.",
      "draft the sprint review notes":
        "📝 Sprint 47 shipped: new billing dashboard, 12 bug fixes, 94% test coverage on payments service. Carry-over: SSO rollout, mobile push refactor.",
    },
    eventsTitle: "Engineering Events",
    events: [
      { icon: AlertTriangle, tag: "Incident", title: "Checkout API recovered — 18min outage resolved", minutesAgo: 8 },
      { icon: Code2, tag: "Deploy", title: "v4.21.0 shipped to production by @marcus", minutesAgo: 35 },
      { icon: Users, tag: "Standup", title: "Platform team flagged Redis capacity risk", minutesAgo: 92 },
      { icon: TrendingUp, tag: "Metric", title: "API p95 latency dropped 22% week-over-week", minutesAgo: 156 },
    ],
  },
  insurance: {
    label: "Insurance Adjuster",
    icon: Shield,
    greeting: "{timeGreeting} — I've indexed 4,302 claims, 89 adjuster reports, and today's risk feeds. How can I help?",
    suggestions: [
      "Flag claims at risk of fraud",
      "Summarize Hurricane Delta exposure",
      "Draft a denial letter for claim #88421",
    ],
    scripted: {
      "flag claims at risk of fraud":
        "🚩 7 claims flagged this morning. Top signal: claim #91230 — same IP submitted 3 unrelated auto claims in 48h. Recommend SIU referral.",
      "summarize hurricane delta exposure":
        "🌀 Estimated exposure: $48M across 1,204 policies in FL/GA. 312 first-notice-of-loss filings in last 24h. Reinsurance threshold reached at $32M.",
      "draft a denial letter for claim #88421":
        "✍️ Draft ready. Cites policy section 4.2 (excluded peril), references adjuster report from Mar 8, includes appeals process. Awaiting your review.",
    },
    eventsTitle: "Risk Events",
    events: [
      { icon: AlertTriangle, tag: "Catastrophe", title: "Hurricane Delta upgraded to Cat 4 — FL coast", minutesAgo: 22 },
      { icon: FileText, tag: "Claim", title: "High-value claim #88421 ready for adjuster review", minutesAgo: 65 },
      { icon: TrendingUp, tag: "Fraud", title: "SIU flagged 7 new suspicious auto claims overnight", minutesAgo: 110 },
      { icon: Shield, tag: "Reg", title: "NAIC bulletin on AI-driven underwriting published", minutesAgo: 240 },
    ],
  },
};

const formatRelative = (minutesAgo: number, now: Date) => {
  const m = minutesAgo;
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const formatClock = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const formatDate = (d: Date) =>
  d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

const getTimeGreeting = (d: Date) => {
  const h = d.getHours();
  if (h < 12) return "👋 Good morning";
  if (h < 18) return "👋 Good afternoon";
  return "👋 Good evening";
};

export const LawyerDemo = () => {
  const [roleKey, setRoleKey] = useState<RoleKey>("lawyer");
  const role = ROLES[roleKey];
  const initialGreeting = role.greeting.replace("{timeGreeting}", getTimeGreeting(new Date()));
  const [messages, setMessages] = useState<Msg[]>([{ role: "ai", text: initialGreeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const [tick, setTick] = useState(0);

  // Live clock + event-age tick
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Reset chat when role changes
  useEffect(() => {
    const greeting = role.greeting.replace("{timeGreeting}", getTimeGreeting(new Date()));
    setMessages([{ role: "ai", text: greeting }]);
    setInput("");
  }, [roleKey, role.greeting]);

  // Drift event timestamps so they feel live
  const liveEvents = useMemo(() => {
    const drift = Math.floor(tick / 30); // bump every 30s
    return role.events.map((e) => ({ ...e, minutesAgo: e.minutesAgo + drift }));
  }, [role.events, tick]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const reply = role.scripted[text.toLowerCase().trim()] ??
        "🔒 In the live product I'd answer this from your private company data. This is a demo — try one of the suggested prompts.";
      setMessages((m) => [...m, { role: "ai", text: reply }]);
      setLoading(false);
    }, 900);
  };

  const RoleIcon = role.icon;

  return (
    <section id="demo" className="container py-16 md:py-24">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 text-xs text-primary mb-3">
          <RoleIcon className="h-4 w-4" />
          INTERACTIVE DEMO
        </div>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
          A day as a{" "}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 text-gradient-primary hover:opacity-80 transition-opacity align-baseline">
              {role.label}
              <ChevronDown className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="bg-popover border-border">
              {(Object.keys(ROLES) as RoleKey[]).map((k) => {
                const Icon = ROLES[k].icon;
                return (
                  <DropdownMenuItem
                    key={k}
                    onClick={() => setRoleKey(k)}
                    className="gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {ROLES[k].label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </h2>
        <p className="mt-4 text-muted-foreground">
          Pick a role to see how Agant blends private chat with a live events feed tailored to their work.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 max-w-6xl mx-auto">
        {/* Chat card */}
        <Card className="bg-gradient-card border-border shadow-elegant overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <div className="flex gap-2">
              <button aria-label="Close" className="group h-3.5 w-3.5 rounded-full bg-[#FF5F57] flex items-center justify-center hover:brightness-110">
                <X className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
              </button>
              <button aria-label="Minimize" className="group h-3.5 w-3.5 rounded-full bg-[#FEBC2E] flex items-center justify-center hover:brightness-110">
                <Minus className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
              </button>
              <button aria-label="Maximize" className="group h-3.5 w-3.5 rounded-full bg-[#28C840] flex items-center justify-center hover:brightness-110">
                <Maximize2 className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
              </button>
            </div>
            <div className="flex-1 text-center text-xs text-muted-foreground font-medium">
              alsu-ospan
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums hidden sm:block">
              {formatClock(now)}
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-4 min-h-[360px] max-h-[460px] overflow-y-auto flex-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 animate-slide-up ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "ai" && (
                  <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-foreground"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="rounded-2xl px-4 py-2.5 bg-secondary/60 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Agant is thinking…
                </div>
              </div>
            )}
          </div>

          <div className="px-4 md:px-6 pb-3">
            <div className="flex flex-wrap gap-2">
              {role.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/30 hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2 p-4 border-t border-border bg-primary/10"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about anything…"
              className="flex-1 bg-background/40 border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <Button type="submit" size="icon" className="bg-primary text-primary-foreground shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        {/* Live Events feed */}
        <Card className="bg-gradient-card border-border shadow-elegant overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{role.eventsTitle}</h3>
              <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                {formatDate(now)} · {formatClock(now)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-glow animate-pulse-dot" />
              Live
            </div>
          </div>

          <div className="p-3 space-y-2 overflow-y-auto flex-1 max-h-[460px]">
            {liveEvents.map((e, i) => {
              const Icon = e.icon;
              return (
                <div
                  key={`${roleKey}-${i}`}
                  className="flex gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 hover:border-primary/40 border border-transparent transition-colors cursor-pointer group"
                >
                  <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-primary font-medium">{e.tag}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{formatRelative(e.minutesAgo, now)}</span>
                    </div>
                    <p className="text-sm leading-snug text-foreground/90 group-hover:text-foreground">
                      {e.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
};
