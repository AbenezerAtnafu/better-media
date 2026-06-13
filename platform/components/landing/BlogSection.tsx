import Image from "next/image";
import Link from "next/link";
import { getBlogPages } from "@/app/source";
import { Reveal } from "./Reveal";
import { TagBadge } from "../blog/TagBadge";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogSection() {
  const posts = getBlogPages()
    .map((page) => ({
      title: page.data.title,
      description: page.data.description,
      date: page.data.date,
      tags: page.data.tags,
      readingTime: page.data.readingTime,
      image: page.data.image,
      url: page.url,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  if (posts.length === 0) return null;

  const [featured, ...rest] = posts;

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Subtle accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <span className="inline-flex items-center rounded-md border border-brand-accent/20 bg-brand-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent font-mono mb-6">
              From the Blog
            </span>
            <h2 className="text-4xl md:text-5xl font-bold font-headline tracking-[-0.03em] text-white leading-[1.05]">
              Ideas &amp; updates.
            </h2>
          </div>
          <Link
            href="/blog"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors shrink-0 pb-1"
          >
            View all posts
            <span
              className="material-symbols-outlined transition-transform group-hover:translate-x-0.5"
              style={{ fontSize: "16px" }}
            >
              arrow_forward
            </span>
          </Link>
        </Reveal>

        {/* Grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Featured post — spans 2 cols */}
          {featured && (
            <Reveal className="md:col-span-2" delay={100}>
              <Link
                href={featured.url}
                className="group flex flex-col bg-surface border border-border rounded-2xl overflow-hidden hover:border-zinc-700 transition-all duration-300 h-full"
              >
                {featured.image && (
                  <div className="relative w-full aspect-[16/9] overflow-hidden bg-zinc-900">
                    <Image
                      src={featured.image}
                      alt={featured.title}
                      fill
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="flex flex-col flex-1 p-8 gap-4">
                  <div className="flex items-center gap-3">
                    {featured.tags[0] && <TagBadge tag={featured.tags[0]} />}
                    <span className="text-[11px] font-mono text-zinc-600">
                      {formatDate(featured.date)}
                      {featured.readingTime && <> &middot; {featured.readingTime} min read</>}
                    </span>
                  </div>
                  <h3 className="text-2xl font-headline font-bold tracking-[-0.03em] text-white group-hover:text-slate-200 transition-colors leading-snug">
                    {featured.title}
                  </h3>
                  {featured.description && (
                    <p className="text-slate-400 text-sm leading-relaxed line-clamp-2 font-body">
                      {featured.description}
                    </p>
                  )}
                  <div className="mt-auto pt-4 flex items-center gap-1.5 text-xs font-semibold text-brand-accent group-hover:gap-2.5 transition-all">
                    Read more
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      arrow_forward
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          )}

          {/* Smaller posts — stacked in 1 col */}
          <div className="flex flex-col gap-5">
            {rest.map((post, i) => (
              <Reveal key={post.url} delay={200 + i * 100}>
                <Link
                  href={post.url}
                  className="group flex flex-col bg-surface border border-border rounded-2xl overflow-hidden hover:border-zinc-700 transition-all duration-300 h-full"
                >
                  {post.image && (
                    <div className="relative w-full aspect-[2/1] overflow-hidden bg-zinc-900">
                      <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 p-6 gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.tags[0] && <TagBadge tag={post.tags[0]} />}
                      <span className="text-[11px] font-mono text-zinc-600">
                        {formatDate(post.date)}
                      </span>
                    </div>
                    <h3 className="text-base font-headline font-bold tracking-[-0.02em] text-white group-hover:text-slate-200 transition-colors leading-snug">
                      {post.title}
                    </h3>
                    {post.description && (
                      <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 font-body">
                        {post.description}
                      </p>
                    )}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
