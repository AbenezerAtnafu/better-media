import Image from "next/image";
import Link from "next/link";
import { TagBadge } from "./TagBadge";

interface PostCardProps {
  title: string;
  description?: string;
  date: string;
  tags: string[];
  readingTime?: number;
  url: string;
  image?: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PostCard({
  title,
  description,
  date,
  tags,
  readingTime,
  url,
  image,
}: PostCardProps) {
  return (
    <Link
      href={url}
      className="group flex flex-col rounded-xl glass-morphism overflow-hidden hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-200"
    >
      {image && (
        <div className="relative w-full aspect-[2/1] overflow-hidden bg-zinc-900">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}

      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 flex-wrap">
          {tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        <div className="space-y-2">
          <h2 className="font-headline text-lg font-bold tracking-tight text-zinc-100 group-hover:text-white transition-colors leading-snug">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-600 mt-auto pt-2 border-t border-white/[0.06]">
          <span>{formatDate(date)}</span>
          {readingTime && (
            <>
              <span>·</span>
              <span>{readingTime} min read</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
