import { getBlogPages } from "@/app/source";
import { BlogList } from "@/components/blog/BlogList";

export const metadata = {
  title: "Blog — Better Media",
  description:
    "Release notes, tutorials, engineering deep-dives, and ecosystem updates from the Better Media team.",
};

export default function BlogPage() {
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
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="relative">
      <div className="mesh-gradient absolute inset-0 pointer-events-none" />
      <div className="subtle-grid absolute inset-0 pointer-events-none opacity-30" />

      <div className="relative max-w-5xl mx-auto px-6 sm:px-8 pt-32 pb-24">
        {/* Header */}
        <div className="mb-16 space-y-4">
          <span className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 font-mono">
            Blog
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Better Media Engineering
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl leading-relaxed">
            Release notes, tutorials, and engineering insights from the team building Better Media.
          </p>
        </div>

        <BlogList posts={posts} />
      </div>
    </div>
  );
}
