import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/hero.png"
          alt="Better Media Hero"
          fill
          className="object-cover opacity-60 transition-opacity duration-1000"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      </div>

      <div className="z-10 flex flex-col items-center text-center px-6">
        <div className="mb-8 rounded-2xl bg-white/5 p-4 backdrop-blur-xl ring-1 ring-white/10">
          <Image
            src="/logo.png"
            alt="Better Media Logo"
            width={120}
            height={120}
            className="rounded-xl shadow-2xl shadow-cyan-500/20"
          />
        </div>

        <h1 className="mb-4 text-5xl font-black tracking-tight text-white sm:text-7xl">
          Better Media
        </h1>
        <p className="mb-10 max-w-2xl text-xl text-zinc-400 sm:text-2xl leading-relaxed">
          The modular media pipeline for the modern web. Intake, processing, and storage, built for
          scale.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/docs"
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-cyan-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-600 hover:bg-cyan-700 shadow-xl shadow-cyan-600/30"
          >
            Get Started
            <svg
              className="w-5 h-5 ml-2 -mr-1 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
          <Link
            href="https://github.com/abenezeratnafu/better-media"
            className="inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 backdrop-blur-sm"
          >
            GitHub
          </Link>
        </div>
      </div>

      {/* Stats / Features Grid (Subtle) */}
      <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3 z-10 opacity-80 backdrop-blur-sm p-4 rounded-3xl bg-black/20">
        <div className="text-center">
          <div className="text-3xl font-bold text-cyan-400">Modular</div>
          <div className="text-sm text-zinc-500 uppercase tracking-widest">
            Core/Adapter Architecture
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-violet-400">Extensible</div>
          <div className="text-sm text-zinc-500 uppercase tracking-widest">
            Plugin-Driven Pipeline
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-indigo-400">Scalable</div>
          <div className="text-sm text-zinc-500 uppercase tracking-widest">
            Distributed Worker Support
          </div>
        </div>
      </div>
    </main>
  );
}
