import { Reveal } from "./Reveal";

export function Features() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-24">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Agnostic Storage Layer */}
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
              The same API for S3, Azure Blob, GCS, or Local FS. Change your provider in production
              with zero code changes to your application logic.
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

        {/* Safe by Default */}
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

        {/* Runtime Optimized */}
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

        {/* Presigned Everything */}
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
    </section>
  );
}
