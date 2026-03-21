import { Reveal } from "./Reveal";

export function Infrastructure() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-24 text-center">
      <Reveal>
        <h2 className="text-3xl font-bold font-headline mb-16 tracking-[-0.03em] leading-[1.1] text-white">
          Compatible with your stack.
        </h2>
      </Reveal>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal delay={100}>
          <div className="bg-surface border border-border p-8 rounded-2xl flex flex-col items-center gap-4 hover:bg-zinc-900 transition-all group">
            <div className="w-12 h-12 flex items-center justify-center text-secondary group-hover:text-white transition-colors">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'wght' 200" }}
              >
                database
              </span>
            </div>
            <span className="text-sm font-medium text-secondary">PostgreSQL</span>
          </div>
        </Reveal>
        <Reveal delay={200}>
          <div className="bg-surface border border-border p-8 rounded-2xl flex flex-col items-center gap-4 hover:bg-zinc-900 transition-all group">
            <div className="w-12 h-12 flex items-center justify-center text-secondary group-hover:text-white transition-colors">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'wght' 200" }}
              >
                cloud_upload
              </span>
            </div>
            <span className="text-sm font-medium text-secondary">AWS S3</span>
          </div>
        </Reveal>
        <Reveal delay={300}>
          <div className="bg-surface border border-border p-8 rounded-2xl flex flex-col items-center gap-4 hover:bg-zinc-900 transition-all group">
            <div className="w-12 h-12 flex items-center justify-center text-secondary group-hover:text-white transition-colors">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'wght' 200" }}
              >
                memory
              </span>
            </div>
            <span className="text-sm font-medium text-secondary">MongoDB</span>
          </div>
        </Reveal>
        <Reveal delay={400}>
          <div className="bg-surface border border-border p-8 rounded-2xl flex flex-col items-center gap-4 hover:bg-zinc-900 transition-all group">
            <div className="w-12 h-12 flex items-center justify-center text-secondary group-hover:text-white transition-colors">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'wght' 200" }}
              >
                dns
              </span>
            </div>
            <span className="text-sm font-medium text-secondary">Azure Blob</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
