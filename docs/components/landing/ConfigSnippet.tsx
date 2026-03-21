import { Reveal } from "./Reveal";

export function ConfigSnippet() {
  return (
    <section className="py-24 border-y border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <Reveal>
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold font-headline tracking-[-0.03em] text-white">
                Declarative Media Pipelines.
              </h2>
              <p className="text-slate-400 font-medium max-w-md leading-relaxed">
                Transform images and video on the fly by defining simple schemas. Better Media
                handles the heavy lifting, ensuring consistency across your entire stack.
              </p>
            </div>

            <div className="mt-12 space-y-8">
              <div className="flex gap-5 group">
                <div className="shrink-0 w-10 h-10 rounded-lg glass-morphism border-white/5 flex items-center justify-center text-blue-400 group-hover:bg-blue-400/5 transition-colors">
                  <span className="material-symbols-outlined text-xl font-light">auto_awesome</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-wider font-headline">
                    On-The-Fly Resizing
                  </h4>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                    Generate thumbnails and responsive variants automatically during the upload
                    stream.
                  </p>
                </div>
              </div>

              <div className="flex gap-5 group">
                <div className="shrink-0 w-10 h-10 rounded-lg glass-morphism border-white/5 flex items-center justify-center text-purple-400 group-hover:bg-purple-400/5 transition-colors">
                  <span className="material-symbols-outlined text-xl font-light">token</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-wider font-headline">
                    Type-Safe Metas
                  </h4>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                    First-class Zod integration for your file metadata. Complete end-to-end
                    intellisense.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="relative group delay-200">
            <div className="absolute -inset-10 bg-purple-500/5 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

            <div className="relative glass-morphism rounded-xl overflow-hidden shadow-2xl border-white/5">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500/50"></div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em] font-mono">
                    pipeline_config.ts
                  </span>
                </div>
                <div className="w-10"></div>
              </div>

              <div className="p-8 font-mono text-[13px] leading-[1.6] overflow-x-auto bg-[#020202]/60">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-purple-400">export const</span>{" "}
                    <span className="text-blue-300">media</span> ={" "}
                    <span className="text-blue-400">setup</span>({"{"}
                  </div>
                  <div className="pl-6">
                    <span className="text-slate-400">pipelines</span>: {"{"}
                  </div>
                  <div className="pl-12">
                    <span className="text-slate-400">avatars</span>: {"{"}
                  </div>
                  <div className="pl-[4.5rem]">
                    <span className="text-slate-400">resize</span>: {"{"}{" "}
                    <span className="text-slate-300">w:</span>{" "}
                    <span className="text-amber-400">400</span>,{" "}
                    <span className="text-slate-300">h:</span>{" "}
                    <span className="text-amber-400">400</span> {"}"},
                  </div>
                  <div className="pl-[4.5rem]">
                    <span className="text-slate-400">format</span>:{" "}
                    <span className="text-emerald-400">"webp"</span>,
                  </div>
                  <div className="pl-[4.5rem]">
                    <span className="text-slate-400">cache</span>:{" "}
                    <span className="text-emerald-400">"public, max-age=31M"</span>
                  </div>
                  <div className="pl-12">{"}"},</div>
                  <div className="pl-12">
                    <span className="text-slate-400">banners</span>: {"{"}
                  </div>
                  <div className="pl-[4.5rem]">
                    <span className="text-slate-400">aspect</span>:{" "}
                    <span className="text-emerald-400">"21:9"</span>,
                  </div>
                  <div className="pl-[4.5rem]">
                    <span className="text-slate-400">optimize</span>:{" "}
                    <span className="text-orange-400">true</span>
                  </div>
                  <div className="pl-12">{"}"}</div>
                  <div className="pl-6">{"}"}</div>
                  <div>{"});"}</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
