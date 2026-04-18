import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const Nav = () => (
  <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
    <div className="container flex h-14 items-center justify-between">
      <a href="#" className="flex items-center gap-2 font-semibold">
        <span className="text-[15px] tracking-tight">Agant</span>
      </a>
      <nav className="hidden md:flex items-center gap-6 text-[13px] text-muted-foreground">
        <a href="#demo" className="hover:text-foreground transition-colors">Try it</a>
        <a href="#features" className="hover:text-foreground transition-colors">Toolkit</a>
        <a href="#privacy" className="hover:text-foreground transition-colors">Why private</a>
        <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-[13px] h-8">
          <Link to="/signin">Sign in</Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="h-8 text-[13px] bg-foreground text-background hover:bg-foreground/90 rounded-md"
        >
          <Link to="/signin">Get started</Link>
        </Button>
      </div>
    </div>
  </header>
);
