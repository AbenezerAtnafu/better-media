"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import corePackage from "../../../packages/core/package.json";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/85 backdrop-blur-xl border-b border-white/[0.07]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="flex min-h-14 items-center justify-between gap-4 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-white/30"
        >
          <div className="h-7 w-7 shrink-0 bg-white rounded-md flex items-center justify-center shadow-[0_0_18px_rgba(255,255,255,0.15)]">
            <span
              className="material-symbols-outlined text-black"
              style={{ fontSize: "17px", fontVariationSettings: "'FILL' 1" }}
            >
              cloud_queue
            </span>
          </div>
          <span className="text-sm font-bold tracking-[-0.03em] text-white font-headline">
            Better Media
          </span>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 leading-none">
            v{corePackage.version}
          </span>
        </Link>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-0.5">
          {[
            { label: "Docs", href: "/docs" },
            { label: "Plugins", href: "/docs/plugins/validation" },
            { label: "Architecture", href: "/docs/architecture" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="px-3 py-1.5 text-xs font-semibold tracking-tight text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-all duration-150"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/abenezeratnafu/better-media"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tracking-tight text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-all duration-150"
            rel="noopener noreferrer"
            target="_blank"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "15px", fontVariationSettings: "'FILL' 0, 'wght' 400" }}
            >
              code
            </span>
            GitHub
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-white px-3.5 py-1.5 text-xs font-bold font-headline text-black tracking-[-0.02em] transition-colors hover:bg-slate-200 shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
