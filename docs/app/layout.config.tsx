import { type BaseLayoutProps } from "fumadocs-ui/layout";

// basic configuration here
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div className="flex items-center font-bold">
        <img src="/logo.png" className="w-8 h-8 mr-2 rounded-lg" alt="Better Media Logo" />
        Better Media
      </div>
    ),
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "GitHub",
      url: "https://github.com/abenezeratnafu/better-media",
    },
  ],
};
