import { Reveal } from "./Reveal";

const steps = [
  {
    number: "01",
    title: "Install",
    description: "Add Better Media, then bring in the adapters and plugins your app needs.",
    code: "npm i better-media",
  },
  {
    number: "02",
    title: "Configure",
    description: "Create a small media config that defines your storage, database, and plugins.",
    code: "media.config.ts",
  },
  {
    number: "03",
    title: "First Upload",
    description: "Ingest your first file through one upload API and let the pipeline do the rest.",
    code: "await media.upload.ingest({...})",
  },
];

export function QuickStart() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-md border border-brand-accent/20 bg-brand-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent font-mono">
            Quick Start
          </span>
          <h2 className="mt-6 text-4xl md:text-5xl font-bold font-headline tracking-[-0.03em] text-white">
            Get started in minutes.
          </h2>
          <p className="mt-4 text-slate-400 font-medium leading-relaxed">
            Install the package, define your media config, and ship your first upload with a single
            runtime.
          </p>
        </Reveal>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <Reveal
              key={step.number}
              delay={100 + index * 100}
              className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:-translate-y-1 hover:border-zinc-700"
            >
              <div className="text-4xl font-bold font-headline tracking-[-0.04em] text-white/10">
                {step.number}
              </div>
              <h3 className="mt-4 text-xl font-bold font-headline tracking-[-0.02em] text-white">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 min-h-[3.75rem]">
                {step.description}
              </p>
              <div className="mt-5 rounded-xl border border-white/5 bg-surface-muted px-4 py-3 font-mono text-xs text-brand-accent overflow-x-auto">
                <code>{step.code}</code>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
