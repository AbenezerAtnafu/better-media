import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBlogPage, getBlogPages } from "@/app/source";
import { TagBadge } from "@/components/blog/TagBadge";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getBlogPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  if (!page) return {};

  return {
    title: `${page.data.title} — Better Media Blog`,
    description: page.data.description,
    openGraph: {
      images: page.data.image ? [{ url: page.data.image }] : [],
    },
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  if (!page) notFound();

  const MDXContent = page.data.body;
  const { title, description, date, tags, readingTime, author, image } = page.data;

  return (
    <div className="relative">
      <div className="mesh-gradient absolute inset-0 pointer-events-none" />

      <div className="relative max-w-2xl mx-auto px-6 sm:px-8 pt-32 pb-24">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-white transition-colors mb-12 group"
        >
          <span
            className="material-symbols-outlined transition-transform group-hover:-translate-x-0.5"
            style={{ fontSize: "14px" }}
          >
            arrow_back
          </span>
          Blog
        </Link>

        {/* Post header */}
        <header className="space-y-5 mb-10">
          <div className="flex items-center gap-3 flex-wrap">
            {tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            <span className="text-[11px] font-mono text-zinc-600">
              {formatDate(date)}
              {readingTime && <> · {readingTime} min read</>}
            </span>
          </div>

          <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            {title}
          </h1>

          {description && <p className="text-zinc-400 text-lg leading-relaxed">{description}</p>}

          <div className="text-xs text-zinc-600 font-mono">By {author}</div>
        </header>

        {/* Cover image */}
        {image && (
          <div className="relative w-full aspect-[2/1] rounded-xl overflow-hidden subtle-border mb-10">
            <Image src={image} alt={title} fill className="object-cover" />
          </div>
        )}

        <hr className="border-white/[0.08] mb-10" />

        {/* MDX content */}
        <div className="blog-prose">
          <MDXContent />
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/[0.08]">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-white transition-colors group"
          >
            <span
              className="material-symbols-outlined transition-transform group-hover:-translate-x-0.5"
              style={{ fontSize: "14px" }}
            >
              arrow_back
            </span>
            All posts
          </Link>
        </div>
      </div>
    </div>
  );
}
