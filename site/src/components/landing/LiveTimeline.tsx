import { Lock, ShieldCheck, Server, EyeOff, FileKey } from "lucide-react";
import { Card } from "@/components/ui/card";

const REASONS = [
  {
    icon: Server,
    title: "Your server, your walls",
    body: "Agant ships as physical hardware to your office. The model, the data, and every inference run on a machine you can unplug.",
  },
  {
    icon: EyeOff,
    title: "No outbound traffic",
    body: "By default the box has zero internet egress. No telemetry, no model providers, no third-party logging. Air-gapped if you want it.",
  },
  {
    icon: FileKey,
    title: "Encrypted end-to-end",
    body: "Every email, document, and embedding is encrypted at rest with keys only your IT team holds. We literally can't read your data.",
  },
  {
    icon: ShieldCheck,
    title: "Auditable by design",
    body: "Every prompt, every response, every action is logged. Compliance, legal, and your CISO get a verifiable trail without lifting a finger.",
  },
];

export const LiveTimeline = () => (
  <section id="privacy" className="container py-20 md:py-24">
    <div className="grid md:grid-cols-2 gap-12 items-center">
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em] mb-4">
          Why Private AI
        </div>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]">
          Cloud AI sees everything.
          <br />
          <span className="text-muted-foreground">Agant sees nothing.</span>
        </h2>
        <p className="mt-5 text-muted-foreground text-base md:text-lg leading-relaxed max-w-md">
          Most AI tools quietly pipe your inbox, contracts, and meetings to someone
          else's data center. We took a different path: we ship the server. You own
          the data. Privacy isn't a setting — it's the architecture.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 text-primary" />
          Privacy by architecture, not by promise
        </div>
      </div>

      <div className="space-y-3">
        {REASONS.map((r) => {
          const Icon = r.icon;
          return (
            <Card
              key={r.title}
              className="bg-card hover:bg-secondary/40 border border-border p-6 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="h-9 w-9 rounded-md border border-border bg-background flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-[15px] tracking-tight">{r.title}</div>
                  <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
                    {r.body}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  </section>
);
