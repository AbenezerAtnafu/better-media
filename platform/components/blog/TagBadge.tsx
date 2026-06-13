const tagStyles: Record<string, string> = {
  release: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  tutorial: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  engineering: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  ecosystem: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const tagLabels: Record<string, string> = {
  release: "Release",
  tutorial: "Tutorial",
  engineering: "Engineering",
  ecosystem: "Ecosystem",
};

interface TagBadgeProps {
  tag: string;
  className?: string;
}

export function TagBadge({ tag, className = "" }: TagBadgeProps) {
  const style = tagStyles[tag] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  const label = tagLabels[tag] ?? tag;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider border leading-none ${style} ${className}`}
    >
      {label}
    </span>
  );
}
