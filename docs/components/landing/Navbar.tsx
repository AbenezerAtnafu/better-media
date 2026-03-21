import Link from "next/link";

export function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 border-b border-border bg-black/80 backdrop-blur-md">
      <nav className="flex justify-between items-center px-6 py-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
            <span
              className="material-symbols-outlined text-black text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              cloud_queue
            </span>
          </div>
          <span className="text-sm font-bold tracking-[-0.02em] text-white font-headline">
            Better Media
          </span>
        </div>
        <div className="ml-auto flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6 mr-4">
            <Link
              className="text-zinc-400 hover:text-white transition-colors text-xs font-semibold tracking-tight"
              href="/docs"
            >
              Docs
            </Link>
            <Link
              className="text-zinc-400 hover:text-white transition-colors text-xs font-semibold tracking-tight"
              href="#"
            >
              Changelog
            </Link>
            <Link
              className="text-zinc-400 hover:text-white transition-colors text-xs font-semibold tracking-tight"
              href="https://github.com/abenezeratnafu/better-media"
            >
              GitHub
            </Link>
          </div>
          <button className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold font-headline tracking-[-0.02em] hover:bg-slate-200 transition-all flex items-center gap-1.5 whitespace-nowrap">
            <span className="material-symbols-outlined text-[16px]">star</span>
            Star on GitHub
          </button>
        </div>
      </nav>
    </header>
  );
}
