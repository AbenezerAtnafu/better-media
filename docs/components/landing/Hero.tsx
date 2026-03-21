"use client";

import Link from "next/link";
import { useState } from "react";

export function Hero() {
  const [copied, setCopied] = useState(false);
  const command = "npm i better-media";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col justify-center min-h-[80vh] pt-32 pb-20 lg:pt-40 lg:pb-24 relative">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Left Column: Refined Typography */}
        <div className="flex flex-col items-center lg:items-start space-y-10 animate-slide-up">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-md glass-morphism border-brand-accent/20 bg-brand-accent/5 animate-slow-pulse shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            </span>
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-brand-accent font-mono">
              Protocol v0.10.0
            </span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline leading-[1.1] tracking-[-0.03em] text-white opacity-0 animate-slide-up [animation-delay:100ms] [animation-fill-mode:forwards]">
              Media handling
              <br />
              <span className="text-slate-500 font-medium">
                shouldn't be this{" "}
                <span className="font-mono font-medium text-brand-accent text-gradient lg:text-[3.75rem]">
                  hard.
                </span>
              </span>
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-md font-normal font-body leading-relaxed opacity-0 animate-slide-up [animation-delay:200ms] [animation-fill-mode:forwards]">
              Upload, transform, and serve files with a clean API and pluggable adapters for any
              storage or database.
            </p>
          </div>

          <div className="flex flex-wrap justify-center lg:justify-start gap-4 opacity-0 animate-slide-up [animation-delay:300ms] [animation-fill-mode:forwards]">
            <Link
              href="/docs"
              className="bg-white text-black px-8 py-3 rounded-md font-bold text-sm font-headline tracking-[-0.02em] hover:bg-slate-200 transition-all duration-300 shadow-sm"
            >
              Get Started
            </Link>
            <Link
              href="/docs"
              className="glass-morphism text-slate-300 px-8 py-3 rounded-md font-semibold text-sm font-headline tracking-[-0.02em] hover:bg-white/5 transition-all duration-300"
            >
              View Documentation
            </Link>
          </div>

          <div className="pt-8 opacity-0 animate-slide-up [animation-delay:400ms] [animation-fill-mode:forwards]">
            <div className="flex items-center gap-6">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-600 font-mono">
                Supports
              </span>
              <div className="flex flex-wrap gap-4 items-center">
                <span className="text-[11px] font-mono text-slate-500 font-medium">S3_STORAGE</span>
                <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                <span className="text-[11px] font-mono text-slate-500 font-medium">GCS_BLOB</span>
                <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                <span className="text-[11px] font-mono text-slate-500 font-medium">AZURE_FILE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Precise Technical Visual */}
        <div className="relative group opacity-0 animate-slide-up [animation-delay:500ms] [animation-fill-mode:forwards]">
          <div className="absolute -inset-10 bg-blue-500/5 blur-[100px] rounded-full"></div>

          <div className="relative glass-morphism rounded-xl overflow-hidden shadow-2xl border-white/5">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex gap-2">
                <div className="w-2.5 h-2.5 rounded-full border border-white/10"></div>
                <div className="w-2.5 h-2.5 rounded-full border border-white/10"></div>
                <div className="w-2.5 h-2.5 rounded-full border border-white/10"></div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono tracking-[0.1em] uppercase">
                core/config.ts
              </div>
              <div className="w-10"></div>
            </div>

            <div className="p-8 font-mono text-[13px] leading-[1.6] overflow-x-auto bg-[#020202]/60">
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">01</div>
                <div>
                  <span className="text-purple-400">export const</span>{" "}
                  <span className="text-blue-300">media</span> ={" "}
                  <span className="text-blue-400">createBetterMedia</span>({"{"}
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">02</div>
                <div className="pl-6 text-slate-400">storage, database,</div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">03</div>
                <div className="pl-6">
                  <span className="text-slate-400">plugins</span>: [
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">04</div>
                <div className="pl-12">
                  <span className="text-blue-400">validationPlugin</span>({"{"}
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">05</div>
                <div className="pl-[4.5rem]">
                  <span className="text-slate-400">useMagicBytes</span>:{" "}
                  <span className="text-amber-400">true</span>,
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">06</div>
                <div className="pl-[4.5rem]">
                  <span className="text-slate-400">allowedMime</span>: [
                  <span className="text-emerald-400">"image/webp"</span>]
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">07</div>
                <div className="pl-12">{"}),"}</div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">08</div>
                <div className="pl-12">
                  <span className="text-blue-400">virusScanPlugin</span>({"{"}
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">09</div>
                <div className="pl-[4.5rem]">
                  <span className="text-slate-400">scanner</span>:{" "}
                  <span className="text-purple-400">new</span>{" "}
                  <span className="text-blue-400">ClamScanner</span>(),
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">10</div>
                <div className="pl-12">{"}),"}</div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">11</div>
                <div className="pl-6">]</div>
              </div>
              <div className="flex gap-6">
                <div className="text-slate-800 select-none text-right w-4">12</div>
                <div>{"});"}</div>
              </div>
            </div>
          </div>

          {/* Precision Installation Command */}
          <div className="mt-8 flex items-center justify-between glass-morphism rounded-lg px-5 py-4 bg-white/[0.01] group border-white/5">
            <div className="flex items-center gap-4">
              <span className="text-slate-600 font-mono text-xs select-none">$</span>
              <code className="font-mono text-sm text-slate-300">{command}</code>
            </div>
            <button
              onClick={handleCopy}
              className={`transition-all duration-300 ${copied ? "text-brand-accent scale-110" : "text-slate-600 hover:text-slate-300"}`}
              title="Copy to clipboard"
            >
              <span className="material-symbols-outlined text-lg font-light">
                {copied ? "check" : "content_copy"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
