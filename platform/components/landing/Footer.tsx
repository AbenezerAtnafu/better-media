import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-black border-t border-border">
      <div className="max-w-7xl mx-auto px-8 py-20">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-black text-xs"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  cloud
                </span>
              </div>
              <span className="text-md font-bold text-white tracking-tight">Better Media</span>
            </div>
            <p className="text-secondary text-sm max-w-sm leading-relaxed">
              The high-performance media toolkit for modern engineering teams. Open source and
              secure by design.
            </p>
            <div className="text-[10px] text-zinc-600 font-mono">
              © 2026 BETTER MEDIA PROJECT. MIT LICENSE.
            </div>
          </div>
          <div>
            <h5 className="text-white text-[11px] font-bold uppercase tracking-widest mb-6">
              Resources
            </h5>
            <ul className="space-y-4 text-sm text-secondary">
              <li>
                <Link className="hover:text-white transition-colors" href="/docs">
                  Documentation
                </Link>
              </li>
              <li>
                <Link className="hover:text-white transition-colors" href="/docs/get-started">
                  Get Started
                </Link>
              </li>
              <li>
                <Link className="hover:text-white transition-colors" href="/docs/architecture">
                  Architecture
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="text-white text-[11px] font-bold uppercase tracking-widest mb-6">
              Social
            </h5>
            <ul className="space-y-4 text-sm text-secondary">
              <li>
                <Link
                  className="hover:text-white transition-colors"
                  href="https://github.com/abenezeratnafu/better-media"
                >
                  GitHub
                </Link>
              </li>
              <li>
                <span className="text-zinc-600">Discord</span>
              </li>
              <li>
                <span className="text-zinc-600">X / Twitter</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-20 pt-8 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
          <span>Built by builders for builders</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-accent"></span> Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
