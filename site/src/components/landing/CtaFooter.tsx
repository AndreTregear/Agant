import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CtaFooter = () => (
  <>
    <section id="contact" className="container py-20 md:py-32">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 100%, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
        />
        <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.05] max-w-2xl mx-auto">
            Bring AI to your business.
            <br />
            <span className="text-muted-foreground">Without giving it away.</span>
          </h2>
          <p className="mt-5 text-muted-foreground max-w-lg mx-auto text-base md:text-lg leading-relaxed">
            We ship the server. You plug it in. Your data stays inside your walls — forever.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="h-11 px-5 bg-foreground text-background hover:bg-foreground/90 rounded-md text-sm font-medium"
            >
              Request a server
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5 border-border bg-transparent hover:bg-secondary/40 rounded-md text-sm font-medium"
            >
              Read the security whitepaper
            </Button>
          </div>
        </div>
      </div>
    </section>

    <footer className="border-t border-border">
      <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-muted-foreground">
        <div>© {new Date().getFullYear()} Agant — Private AI for business.</div>
        <div className="flex gap-6">
          <a href="#privacy" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Security</a>
          <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  </>
);
