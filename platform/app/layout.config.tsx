import { type BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white">
            <span
              className="material-symbols-outlined text-xl text-black"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              cloud_queue
            </span>
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="font-headline text-sm font-bold tracking-[-0.02em] text-foreground">
              Better Media
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Developer docs
            </span>
          </div>
        </div>
      </div>
    ),
  },
  links: [
    {
      text: "Site",
      url: "/",
    },
    {
      text: "Docs",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "Source",
      url: "https://github.com/abenezeratnafu/better-media",
      external: true,
    },
  ],
};
