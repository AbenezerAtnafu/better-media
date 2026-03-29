import { Reveal } from "./Reveal";

export function Architecture() {
  const connectors = [
    {
      icon: "database",
      iconClassName: "text-brand-accent",
      borderClassName: "group-hover:border-brand-accent/40",
      title: "Database Adapters",
      description: "PostgreSQL, MongoDB, SQLite, and schema tooling.",
    },
    {
      icon: "cloud",
      iconClassName: "text-purple-400",
      borderClassName: "group-hover:border-purple-400/40",
      title: "Storage Adapters",
      description: "S3, Cloudflare R2, Google GCS, filesystem, or memory.",
    },
    {
      icon: "extension",
      iconClassName: "text-emerald-400",
      borderClassName: "group-hover:border-emerald-400/40",
      title: "Official Plugins",
      description: "Validation, virus scanning, and media processing hooks.",
    },
  ];

  return (
    <section className="py-24 border-y border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-md border border-brand-accent/20 bg-brand-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent font-mono">
            Architecture
          </span>
          <h2 className="mt-6 text-4xl md:text-5xl font-bold font-headline tracking-[-0.03em] text-white">
            Unified architecture.
          </h2>
          <p className="mt-4 text-slate-400 font-medium leading-relaxed">
            Core defines contracts. Adapters implement infrastructure. The framework orchestrates
            the upload lifecycle around one consistent model.
          </p>
        </Reveal>

        <div className="mt-16 grid lg:grid-cols-[0.95fr_1.05fr] gap-8 lg:gap-12 items-center">
          <Reveal delay={100} className="relative">
            <div className="absolute -inset-8 bg-brand-accent/5 blur-[90px] rounded-full"></div>

            <div className="relative bg-surface border border-brand-accent/20 rounded-3xl p-8 md:p-10 shadow-2xl shadow-brand-accent/5">
              <div className="w-14 h-14 rounded-2xl bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-3xl">settings_input_component</span>
              </div>

              <h3 className="text-2xl font-bold font-headline tracking-[-0.03em] text-white">
                Better Media Core
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 max-w-sm">
                Contracts and lifecycle primitives for uploads, validation, processing, and
                persistence.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-surface-muted border border-border rounded-md text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase">
                  Core Contracts
                </span>
                <span className="px-3 py-1 bg-surface-muted border border-border rounded-md text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase">
                  Adapter Driven
                </span>
                <span className="px-3 py-1 bg-surface-muted border border-border rounded-md text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase">
                  Plugin Ready
                </span>
              </div>
            </div>
          </Reveal>

          <div className="space-y-4">
            {connectors.map((item, index) => (
              <Reveal key={item.title} delay={200 + index * 100}>
                <div
                  className={`group flex items-start gap-5 rounded-2xl border border-border bg-surface px-6 py-5 transition-all hover:-translate-y-1 ${item.borderClassName}`}
                >
                  <div className="w-12 h-12 rounded-full bg-surface-muted border border-white/5 flex items-center justify-center shrink-0">
                    <span className={`material-symbols-outlined text-[22px] ${item.iconClassName}`}>
                      {item.icon}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-white font-headline tracking-[-0.02em]">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
