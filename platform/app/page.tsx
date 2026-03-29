import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Architecture } from "@/components/landing/Architecture";
import { Infrastructure } from "@/components/landing/Infrastructure";
import { PluginsGallery } from "@/components/landing/PluginsGallery";
import { QuickStart } from "@/components/landing/QuickStart";
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
        <QuickStart />
        <Features />
        <Architecture />
        <Infrastructure />
        <PluginsGallery />
        <Contributors />
      </main>
      <Footer />
    </div>
  );
}
