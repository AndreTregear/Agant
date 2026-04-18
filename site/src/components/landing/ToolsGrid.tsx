import { Lock, TrendingUp, Filter, Brain, Workflow, BarChart3, Mail, Mic } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

type Tool = {
  icon: typeof Lock;
  name: string;
  desc: string;
  details: string;
  bullets: string[];
};

// Ordered: most impactful → least. Email + Meeting are intentionally separated.
const TOOLS: Tool[] = [
  {
    icon: Lock,
    name: "On-Prem Vault",
    desc: "Encrypted at rest. Never leaves your office.",
    details:
      "Every byte of data — emails, transcripts, documents, embeddings — stays on the server we ship to you. Air-gapped by default, no outbound traffic required.",
    bullets: ["AES-256 at rest", "Zero outbound telemetry", "Hardware-attested boot"],
  },
  {
    icon: TrendingUp,
    name: "Forecaster",
    desc: "Predicts outcomes. Tells you what to do.",
    details:
      "Reads your history and forecasts what happens next — release, delay, or act.",
    bullets: ["Outcome probability", "Clear action call", "Confidence score"],
  },
  {
    icon: Mail,
    name: "Email Summarizer",
    desc: "Inbox triage in seconds.",
    details:
      "Reads every thread, ranks urgency, and drafts replies in your voice. You approve, send, archive — all without re-reading.",
    bullets: ["Urgency ranking", "Voice-matched drafts", "One-click approve & send"],
  },
  {
    icon: Filter,
    name: "Noise → Signal",
    desc: "Isolates ideas. Returns one clear move.",
    details:
      "Pulls every idea out of meetings and emails, merges them into one direction, and outputs the exact next steps.",
    bullets: [
      "Isolates ideas across meetings & email",
      "Merges into one direction",
      "Exact actions & owners",
    ],
  },
  {
    icon: Brain,
    name: "Custom Knowledge",
    desc: "Never stops learning. Always adjusting.",
    details:
      "Continuously trained on your firm's data — every new email, document, and decision improves the model overnight. No retraining cycles, no manual tuning.",
    bullets: ["Live fine-tuning", "Per-team knowledge silos", "Improves measurably each week"],
  },
  {
    icon: Mic,
    name: "Meeting Copilot",
    desc: "An employee in every meeting.",
    details:
      "Listens live, recalls relevant company history, and whispers suggestions and counter-points in real time.",
    bullets: [
      "Live in-meeting suggestions",
      "Recall from company history",
      "Outcome prediction",
    ],
  },
  {
    icon: Workflow,
    name: "Auto Workflows",
    desc: "Trigger actions across your tools.",
    details:
      "Connects to the tools you already use and runs multi-step workflows on your behalf — file a brief, schedule a follow-up, update a CRM record.",
    bullets: ["100+ native integrations", "Conditional branching", "Human-in-the-loop checkpoints"],
  },
  {
    icon: BarChart3,
    name: "Insight Reports",
    desc: "On-demand briefs, whenever you need them.",
    details:
      "Partner-ready briefs on command. Shows what changed, what's at risk, and the best next move.",
    bullets: [
      "Triggered on demand or by event",
      "Ranked next actions",
      "Export to PDF, Slack, email",
    ],
  },
];

export const ToolsGrid = () => (
  <section id="features" className="container py-20 md:py-32">
    <div className="max-w-2xl mb-14">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em] mb-4">
        The Toolkit
      </div>
      <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]">
        Everything your team needs.
        <br />
        <span className="text-muted-foreground">Nothing leaves your walls.</span>
      </h2>
      <p className="mt-5 text-muted-foreground text-base md:text-lg max-w-xl leading-relaxed">
        Eight tools running on a single server in your office. Hover any card to see how it works.
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <HoverCard key={t.name} openDelay={120} closeDelay={80}>
            <HoverCardTrigger asChild>
              <Card className="group rounded-none border-0 bg-card hover:bg-secondary/40 p-6 cursor-pointer transition-colors h-full flex flex-col">
                <div className="h-9 w-9 rounded-md border border-border bg-background flex items-center justify-center mb-5 group-hover:border-primary/60 transition-colors">
                  <Icon className="h-4 w-4 text-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="font-medium text-[15px] tracking-tight">{t.name}</div>
                <div className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
                  {t.desc}
                </div>
              </Card>
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              align="center"
              className="w-80 p-5 bg-popover border-border shadow-elegant"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-md border border-primary/40 bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="font-semibold text-sm tracking-tight">{t.name}</div>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                {t.details}
              </p>
              <ul className="space-y-1.5">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[12px] text-foreground/80">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  </section>
);
