import { Reveal } from "./Reveal";

export function Features() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-md border border-brand-accent/20 bg-brand-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent font-mono">
            Features
          </span>
          <h2 className="mt-6 text-4xl md:text-5xl font-bold font-headline tracking-[-0.03em] text-white">
            Built for production media flows.
          </h2>
          <p className="mt-4 text-slate-400 font-medium leading-relaxed">
            One upload pipeline with strong defaults, portable adapters, and operational features
            that fit real applications.
          </p>
        </Reveal>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <Reveal
            className="md:col-span-2 group bg-surface border border-border rounded-2xl p-10 hover:border-zinc-700 transition-all relative overflow-hidden"
            delay={100}
          >
            <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none text-zinc-500 transition-transform duration-500 group-hover:scale-110">
              <span className="material-symbols-outlined text-9xl">cloud_sync</span>
            </div>
            <div className="relative z-10 max-w-lg">
              <div className="w-10 h-10 bg-brand-accent/10 text-brand-accent rounded-lg flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-xl">storage</span>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-4 tracking-[-0.03em] leading-[1.1] text-white">
                Agnostic Storage Layer
              </h3>
              <p className="text-slate-400 font-normal font-body leading-relaxed mb-8">
                The same API for S3, Azure Blob, GCS, or Local FS. Change your provider in
                production with zero code changes to your application logic.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-surface-muted border border-border rounded-md text-[9px] text-zinc-500 font-mono tracking-wider">
                  ADAPTERS_READY
                </span>
                <span className="px-3 py-1 bg-surface-muted border border-border rounded-md text-[9px] text-zinc-500 font-mono tracking-wider">
                  S3_COMPATIBLE
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal
            className="group bg-surface border border-border rounded-2xl p-10 hover:border-zinc-700 transition-all hover:-translate-y-1"
            delay={200}
          >
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center mb-6 transition-transform group-hover:rotate-12">
              <span className="material-symbols-outlined text-xl">shield_check</span>
            </div>
            <h3 className="text-2xl font-headline font-bold mb-4 tracking-[-0.03em] leading-[1.1] text-white">
              Safe by Default
            </h3>
            <p className="text-slate-400 font-body text-sm leading-relaxed">
              Automatic Magic Number validation for MIME types. Stream-based processing ensures huge
              files never crash your server instance.
            </p>
          </Reveal>

          <Reveal
            className="group bg-surface border border-border rounded-2xl p-10 hover:border-zinc-700 transition-all hover:-translate-y-1"
            delay={300}
          >
            <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-xl">bolt</span>
            </div>
            <h3 className="text-2xl font-headline font-bold mb-4 tracking-[-0.03em] leading-[1.1] text-white">
              Runtime Optimized
            </h3>
            <p className="text-slate-400 font-body text-sm leading-relaxed">
              Zero-dependency core. Ultra-small bundle footprint. Built on the fastest streaming
              primitives available in Node.js and Deno.
            </p>
          </Reveal>

          <Reveal
            className="md:col-span-2 group bg-surface border border-border rounded-2xl p-10 hover:border-zinc-700 transition-all flex flex-col md:flex-row items-center gap-12"
            delay={400}
          >
            <div className="hidden lg:block w-1/3 bg-zinc-900 aspect-video rounded-xl border border-border overflow-hidden p-4">
              <div className="w-full h-full border border-dashed border-zinc-700 rounded-lg flex items-center justify-center">
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest text-center">
                  Pre-signed UI
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-xl">key</span>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-4 tracking-[-0.03em] leading-[1.1] text-white">
                Presigned Everything
              </h3>
              <p className="text-slate-400 font-body text-sm leading-relaxed">
                Handle multi-gigabyte uploads without touching your server. Secure, time-limited
                presigned URLs with one function call.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
