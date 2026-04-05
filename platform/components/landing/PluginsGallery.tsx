"use client";

import Link from "next/link";
import { useState } from "react";
import { Reveal } from "./Reveal";

const plugins = [
  {
    icon: "verified_user",
    iconClassName: "text-brand-accent",
    borderClassName: "hover:border-brand-accent/40",
    name: "@better-media/plugin-validation",
    description: "Strict MIME validation, size checks, and upload policy enforcement.",
    install: "npm i @better-media/plugin-validation",
  },
  {
    icon: "security",
    iconClassName: "text-purple-400",
    borderClassName: "hover:border-purple-400/40",
    name: "@better-media/plugin-virus-scan",
    description: "ClamAV-powered scanning to stop unsafe files before they reach storage.",
    install: "npm i @better-media/plugin-virus-scan",
  },
  {
    icon: "image",
    iconClassName: "text-cyan-400",
    borderClassName: "hover:border-cyan-400/40",
    name: "@better-media/plugin-media-processing",
    description: "Resize, optimize, and prepare media assets as part of the upload lifecycle.",
    install: "npm i @better-media/plugin-media-processing",
  },
];

export function PluginsGallery() {
  const [copiedPlugin, setCopiedPlugin] = useState<string | null>(null);

  const handleCopy = async (name: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedPlugin(name);
      setTimeout(() => {
        setCopiedPlugin((current) => (current === name ? null : current));
      }, 2000);
    } catch (error) {
      console.error("Failed to copy plugin install command", error);
    }
  };

  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <Reveal className="max-w-xl">
            <span className="inline-flex items-center rounded-md border border-brand-accent/20 bg-brand-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent font-mono">
              Plugins
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold font-headline tracking-[-0.03em] leading-[1.05] text-white">
              Official plugins.
            </h2>
            <p className="mt-4 text-slate-400 font-medium leading-relaxed">
              Extend functionality without writing boilerplate. Plug in validation, scanning, and
              media processing on the same upload lifecycle.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <Link
              href="/docs/plugins"
              className="inline-flex items-center gap-2 text-brand-accent font-semibold hover:text-white transition-colors"
            >
              View Plugins
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plugins.map((plugin, index) => (
            <Reveal
              key={plugin.name}
              delay={150 + index * 100}
              className={`group rounded-2xl border border-border bg-surface p-6 transition-all hover:-translate-y-1 ${plugin.borderClassName}`}
            >
              <span
                className={`material-symbols-outlined mb-4 block text-2xl ${plugin.iconClassName}`}
              >
                {plugin.icon}
              </span>
              <h3 className="text-base font-bold font-headline tracking-[-0.02em] text-white">
                {plugin.name}
              </h3>
              <p className="mt-3 mb-6 text-sm leading-relaxed text-slate-400 min-h-[4.5rem]">
                {plugin.description}
              </p>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-surface-muted px-3 py-2">
                <code className="font-mono text-[10px] text-slate-400 overflow-x-auto">
                  {plugin.install}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(plugin.name, plugin.install)}
                  className={`shrink-0 transition-colors ${
                    copiedPlugin === plugin.name
                      ? "text-brand-accent"
                      : "text-slate-500 hover:text-white"
                  }`}
                  title="Copy install command"
                  aria-label={`Copy install command for ${plugin.name}`}
                >
                  <span className="material-symbols-outlined text-base">
                    {copiedPlugin === plugin.name ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
