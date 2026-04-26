import Link from "next/link";

const navLinkClass =
  "text-zinc-400 hover:text-white transition-colors text-xs font-semibold tracking-tight";

export function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <nav className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 max-w-7xl mx-auto">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-white/30"
        >
          <div className="h-8 w-8 shrink-0 bg-white rounded-md flex items-center justify-center">
            <span
              className="material-symbols-outlined text-black text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              cloud_queue
            </span>
          </div>
          <span className="text-sm font-bold tracking-[-0.02em] text-white font-headline truncate">
            Better Media
          </span>
        </Link>
        <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-6">
          <Link className={navLinkClass + " sm:shrink-0 text-nowrap"} href="/docs">
            Docs
          </Link>
          <Link
            className={navLinkClass + " hidden sm:inline text-nowrap"}
            href="https://github.com/abenezeratnafu/better-media"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </Link>
          <Link
            href="https://github.com/abenezeratnafu/better-media"
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white px-3.5 py-1.5 text-xs font-bold font-headline text-black shadow-sm tracking-[-0.02em] transition-colors hover:bg-slate-200 sm:px-4"
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="material-symbols-outlined text-base">star</span>
            <span className="max-[380px]:sr-only">Star on GitHub</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
