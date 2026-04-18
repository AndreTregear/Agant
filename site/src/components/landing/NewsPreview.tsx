import { Newspaper, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

const NEWS = [
  {
    tag: "Regulation",
    title: "EU AI Act enters phase 2: what privacy-first deployments mean for legal teams",
    summary: "New compliance windows favor on-prem and air-gapped AI. Firms running cloud LLMs face mandatory disclosure by Q3.",
    source: "Reuters · 2h ago",
  },
  {
    tag: "Industry",
    title: "Top 100 law firms are quietly building in-house AI — here's why",
    summary: "Confidentiality, billable-hour pressure, and client mandates push firms away from public models toward dedicated infrastructure.",
    source: "Bloomberg Law · 5h ago",
  },
  {
    tag: "Tech",
    title: "Open-source models close the gap with GPT-4 on legal benchmarks",
    summary: "Llama 3 and Mistral variants now hit 92% of frontier model performance on contract review tasks — at a fraction of the cost.",
    source: "TechCrunch · 1d ago",
  },
];

export const NewsPreview = () => (
  <section id="news" className="container py-16 md:py-24">
    <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
      <div>
        <div className="inline-flex items-center gap-2 text-xs text-primary mb-3">
          <Newspaper className="h-4 w-4" />
          AI-CURATED NEWS
        </div>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight max-w-xl">
          Industry intelligence, <span className="text-gradient-primary">summarized daily</span>
        </h2>
      </div>
      <p className="text-muted-foreground max-w-sm">
        Signal scans hundreds of sources and delivers only what's relevant to your business.
      </p>
    </div>

    <div className="grid md:grid-cols-3 gap-4">
      {NEWS.map((n) => (
        <Card
          key={n.title}
          className="group bg-gradient-card border-border p-6 hover:border-primary/50 transition-all cursor-pointer flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider text-primary font-medium">{n.tag}</span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <h3 className="font-semibold text-base leading-snug mb-3">{n.title}</h3>
          <p className="text-sm text-muted-foreground flex-1">{n.summary}</p>
          <div className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">{n.source}</div>
        </Card>
      ))}
    </div>
  </section>
);
