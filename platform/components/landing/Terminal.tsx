export function Terminal() {
  return (
    <section className="max-w-5xl mx-auto px-6 mb-8">
      <div className="relative group animate-float">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 to-purple-500/20 blur-2xl opacity-50"></div>
        <div className="relative bg-surface border border-border rounded-2xl overflow-hidden code-glow">
          <div className="terminal-header px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
              Configuration — config.ts
            </div>
            <div className="w-12"></div>
          </div>
          <div className="p-8 font-mono text-[14px] leading-relaxed overflow-x-auto">
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">1</div>
              <div>
                <span className="text-purple-400">import</span> {"{ "}
                <span className="text-blue-400">createBetterMedia</span> {"} "}
                <span className="text-purple-400">from</span>{" "}
                <span className="text-emerald-400">"better-media"</span>;
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">2</div>
              <div>
                <span className="text-purple-400">import</span> {"{ "}
                <span className="text-blue-400">s3</span> {"} "}
                <span className="text-purple-400">from</span>{" "}
                <span className="text-emerald-400">"@better-media/s3"</span>;
              </div>
            </div>
            <div className="flex gap-4 h-4">
              <div className="text-zinc-700 select-none text-right w-4">3</div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">4</div>
              <div>
                <span className="text-purple-400">export const</span>{" "}
                <span className="text-blue-400">media</span> ={" "}
                <span className="text-blue-400">createBetterMedia</span>({"{"}
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">5</div>
              <div className="pl-4">
                storage: <span className="text-blue-400">s3</span>({"{"} bucket:{" "}
                <span className="text-emerald-400">"production-assets"</span> {"}"}),
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">6</div>
              <div className="pl-4">rules: {"{"}</div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">7</div>
              <div className="pl-8">
                maxSize: <span className="text-emerald-400">"20mb"</span>,
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">8</div>
              <div className="pl-8">
                allow: [<span className="text-emerald-400">"image/*"</span>,{" "}
                <span className="text-emerald-400">"video/mp4"</span>]
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">9</div>
              <div className="pl-4">{"}"}</div>
            </div>
            <div className="flex gap-4">
              <div className="text-zinc-700 select-none text-right w-4">10</div>
              <div>{"});"}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
