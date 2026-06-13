"use client";

import { useState } from "react";
import { PostCard } from "./PostCard";

const ALL_TAGS = ["release", "tutorial", "engineering", "ecosystem"];

interface Post {
  title: string;
  description?: string;
  date: string;
  tags: string[];
  readingTime?: number;
  url: string;
  image?: string;
}

interface BlogListProps {
  posts: Post[];
}

export function BlogList({ posts }: BlogListProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = activeTag ? posts.filter((p) => p.tags.includes(activeTag)) : posts;

  return (
    <div className="space-y-10">
      {/* Tag filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveTag(null)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all duration-150 ${
            activeTag === null
              ? "bg-white text-black"
              : "text-zinc-400 hover:text-white hover:bg-white/6"
          }`}
        >
          All
        </button>
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-tight capitalize transition-all duration-150 ${
              activeTag === tag
                ? "bg-white/10 text-white border border-white/20"
                : "text-zinc-400 hover:text-white hover:bg-white/6"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Post grid */}
      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">No posts in this category yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((post) => (
            <PostCard key={post.url} {...post} />
          ))}
        </div>
      )}
    </div>
  );
}
