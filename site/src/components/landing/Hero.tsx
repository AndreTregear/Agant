import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

export const Hero = () => (
  <section className="relative overflow-hidden">
    {/* Color spectrum / digital grid background image */}
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none bg-cover bg-center"
      style={{ backgroundImage: `url(${heroBg})` }}
    />
    {/* Fade to background at bottom for seamless blend */}
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--background) / 0.3) 0%, hsl(var(--background) / 0.5) 50%, hsl(var(--background)) 100%)",
      }}
    />
    {/* Accent glow tinted by chosen primary */}
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-[700px] pointer-events-none mix-blend-screen"
      style={{
        background:
          "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.45), transparent 70%)",
      }}
    />

    <div className="container relative pt-24 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-3xl text-center animate-fade-in">
        <a
          href="#demo"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground mb-8 hover:text-foreground hover:border-border transition-colors"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
          Introducing Agant — private AI for your business
          <ArrowRight className="h-3 w-3" />
        </a>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-[-0.04em] text-gradient leading-[0.95]">
          Private AI for <br className="hidden md:block" />
          <span style={{ color: "hsl(var(--primary))" }}>your business.</span>
        </h1>

        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Agant ships a dedicated AI server to your office. It learns your emails,
          meetings, and documents — and your data never leaves your servers.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            size="lg"
            className="h-11 px-5 bg-foreground text-background hover:bg-foreground/90 rounded-md text-sm font-medium"
          >
            <Link to="/signin">
              Try the live demo
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 px-5 border-border bg-transparent hover:bg-secondary/40 rounded-md text-sm font-medium"
          >
            Book a call
          </Button>
        </div>
      </div>
    </div>
  </section>
);
