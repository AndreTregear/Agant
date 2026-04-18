import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { LawyerDemo } from "@/components/landing/LawyerDemo";
import { LiveTimeline } from "@/components/landing/LiveTimeline";
import { ToolsGrid } from "@/components/landing/ToolsGrid";
import { CtaFooter } from "@/components/landing/CtaFooter";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    document.title = "Agant — Private AI for your business";
    const desc = "Agant is on-prem AI that summarizes emails, meetings, and documents. Your data never leaves your servers.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <LawyerDemo />
      <ToolsGrid />
      <LiveTimeline />
      <CtaFooter />
    </main>
  );
};

export default Index;
