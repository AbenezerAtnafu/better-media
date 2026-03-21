import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { ConfigSnippet } from "@/components/landing/ConfigSnippet";
import { Infrastructure } from "@/components/landing/Infrastructure";
import { Contributors } from "@/components/landing/Contributors";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

export default function HomePage() {
  return (
    <div className="landing-page-theme relative min-h-screen text-slate-200">
      <Navbar />
      <main className="mesh-gradient relative">
        <div className="absolute inset-0 subtle-grid -z-10 opacity-30"></div>
        <Hero />
        <Features />
        <ConfigSnippet />
        <Infrastructure />
        <Contributors />
      </main>
      <Footer />
    </div>
  );
}
