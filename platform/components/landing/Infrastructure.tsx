import { Reveal } from "./Reveal";

export function Infrastructure() {
  const databases = [
    { name: "PostgreSQL", icon: "database" },
    { name: "MongoDB", icon: "schema" },
    { name: "SQLite", icon: "data_object" },
  ];

  const storages = [
    { name: "AWS S3", icon: "cloud_upload" },
    { name: "Cloudflare R2", icon: "speed" },
    { name: "Google GCS", icon: "folder_managed" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-24">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-start">
        <Reveal>
          <div className="max-w-xl">
            <span className="inline-flex items-center rounded-md border border-brand-accent/20 bg-brand-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent font-mono">
              Foundation
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold font-headline tracking-[-0.03em] leading-[1.05] text-white">
              Bring your own stack.
            </h2>
            <p className="mt-6 max-w-lg text-slate-400 font-body leading-relaxed">
              Better Media doesn&apos;t lock you into a provider. Mix and match databases and
              storage backends with zero code changes.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-surface-muted border border-border rounded-md text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase">
                Adapter Driven
              </span>
              <span className="px-3 py-1 bg-surface-muted border border-border rounded-md text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase">
                Production Ready
              </span>
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6">
          <Reveal
            delay={100}
            className="group bg-surface border border-border rounded-2xl p-8 hover:border-zinc-700 transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">database</span>
              </div>
              <div>
                <h3 className="text-lg font-bold font-headline tracking-[-0.02em] text-white">
                  Databases
                </h3>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-600 font-mono">
                  Structured metadata
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {databases.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <span className="material-symbols-outlined text-slate-500 text-[22px]">
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-300">{item.name}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal
            delay={200}
            className="group bg-surface border border-border rounded-2xl p-8 hover:border-zinc-700 transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">cloud</span>
              </div>
              <div>
                <h3 className="text-lg font-bold font-headline tracking-[-0.02em] text-white">
                  Storage Adapters
                </h3>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-600 font-mono">
                  Object storage backends
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {storages.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <span className="material-symbols-outlined text-slate-500 text-[22px]">
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-300">{item.name}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
