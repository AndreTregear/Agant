import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SignIn = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Demo mode — any credentials work.
    setTimeout(() => navigate("/app"), 600);
  };

  const handleDemo = () => {
    setLoading(true);
    setTimeout(() => navigate("/app"), 400);
  };

  return (
    <main className="min-h-screen relative flex flex-col">
      {/* Accent glow */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[500px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 0%, hsl(var(--primary) / 0.25), transparent 70%)",
        }}
      />

      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/70">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="text-[15px] font-semibold tracking-tight">
            Agant
          </Link>
          <div className="text-[13px] text-muted-foreground">
            New here?{" "}
            <Link to="/signin" className="text-foreground hover:text-primary transition-colors">
              Request access
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 h-10 w-10 rounded-md border border-border bg-card flex items-center justify-center">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">Sign in to Agant</h1>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Access your private AI workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] text-muted-foreground font-normal">
                Work email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@firm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 bg-card border-border text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] text-muted-foreground font-normal">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                className="h-10 bg-card border-border text-[13px]"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 text-[13px] font-medium"
            >
              {loading ? "Signing in..." : "Continue"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            onClick={handleDemo}
            variant="outline"
            disabled={loading}
            className="w-full h-10 border-border bg-card hover:bg-secondary/40 text-[13px]"
          >
            Sign in as Demo Workspace
          </Button>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            By continuing you agree to keep all data on-prem.
          </p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/50">
        <div className="container h-12 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>© Agant — Private AI</span>
          <Link to="/" className="hover:text-foreground transition-colors">
            ← Back to site
          </Link>
        </div>
      </footer>
    </main>
  );
};

export default SignIn;
