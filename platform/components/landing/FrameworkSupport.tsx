"use client";

import React from "react";
import { Reveal } from "./Reveal";

const frameworks = [
  { name: "Express.js", icon: "code" },
  { name: "NestJS", icon: "api" },
  { name: "Fastify", icon: "bolt" },
  { name: "Koa", icon: "water_drop" },
  { name: "Hapi", icon: "hexagon" },
  { name: "Next.js", icon: "layers" },
  { name: "Bun", icon: "bakery_dining" },
  { name: "Deno", icon: "rainy" },
];

export function FrameworkSupport() {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-40 relative z-10">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <Reveal className="space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold font-headline tracking-tight text-white mb-2">
            Framework Agnostic Support
          </h2>
          <p className="text-brand-accent font-medium font-body text-lg">
            Integrate Better Media with your existing stack — no lock-in, no friction.
          </p>
          <p className="text-slate-400 leading-relaxed font-body">
            Better Media is built to work across the most popular Node.js frameworks and beyond.
            Whether you're building APIs, microservices, or full-stack applications, integration is
            simple and consistent.
          </p>
          <div className="pt-8">
            <div className="glass-morphism rounded-xl p-4 sm:p-5 font-mono text-sm inline-block group border-white/5 shadow-2xl transition-all duration-300 hover:border-brand-accent/20">
              <div className="flex items-center gap-3">
                <span className="text-brand-accent transition-transform group-hover:translate-x-1 duration-300">
                  →
                </span>
                <span className="text-slate-400 break-all leading-relaxed">
                  <span className="text-purple-400">import</span> {"{ "}
                  <span className="text-blue-400">createMedia</span> {"} "}
                  <span className="text-purple-400">from</span>{" "}
                  <span className="text-emerald-400">"better-media"</span>;
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {frameworks.map((fw, i) => (
            <Reveal key={fw.name} delay={i * 50}>
              <div className="glass-morphism p-4 sm:p-5 rounded-xl flex items-center gap-3 sm:gap-4 group hover:border-brand-accent/40 hover:bg-white/[0.04] transition-all cursor-default">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:scale-110 transition-transform duration-300 group-hover:bg-brand-accent/20 shadow-sm group-hover:shadow-brand-accent/20">
                  <span className="material-symbols-outlined text-xl font-light">{fw.icon}</span>
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  {fw.name}
                </span>
              </div>
            </Reveal>
          ))}
          <Reveal delay={400} className="col-span-2 text-center py-4">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-600">
              and more...
            </span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
