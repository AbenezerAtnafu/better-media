import { type BaseLayoutProps } from "fumadocs-ui/layout";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div className="flex items-center font-bold">
        <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-md bg-white">
          <span
            className="material-symbols-outlined text-xl text-black"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            cloud_queue
          </span>
        </div>
        Better Media
      </div>
    ),
  },
  links: [
    {
      text: "Home",
      url: "/",
    },
    {
      text: "Docs",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "GitHub",
      url: "https://github.com/abenezeratnafu/better-media",
    },
  ],
};
