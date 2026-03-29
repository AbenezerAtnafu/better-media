import { pageTree } from "../source";
import { DocsLayout } from "fumadocs-ui/layout";
import type { ReactNode } from "react";
import { baseOptions } from "../layout.config";

const rootSectionOrder = [
  "Overview",
  "Architecture",
  "Storage",
  "Database",
  "Plugins",
  "References",
] as const;

const rootSectionRanks = new Map<string, number>(
  rootSectionOrder.map((name, index) => [name, index])
);

const sectionIcons = new Map<string, string>([
  ["Overview", "rocket_launch"],
  ["Architecture", "account_tree"],
  ["Storage", "cloud_sync"],
  ["Database", "storage"],
  ["Plugins", "extension"],
  ["References", "menu_book"],
]);

function getNodeLabel(name: ReactNode): string {
  return typeof name === "string" ? name : "";
}

function orderRootSections(tree: typeof pageTree): typeof pageTree {
  const children = [...tree.children]
    .sort((a, b) => {
      const left = rootSectionRanks.get(getNodeLabel(a.name)) ?? Number.MAX_SAFE_INTEGER;
      const right = rootSectionRanks.get(getNodeLabel(b.name)) ?? Number.MAX_SAFE_INTEGER;

      if (left !== right) return left - right;
      return getNodeLabel(a.name).localeCompare(getNodeLabel(b.name));
    })
    .map((child) => {
      const label = getNodeLabel(child.name);
      const icon = sectionIcons.get(label);

      if (!icon) return child;

      return {
        ...child,
        name: (
          <span className="inline-flex items-center gap-2">
            <span
              className="material-symbols-outlined leading-none"
              style={{
                fontSize: "18px",
                fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 12",
              }}
            >
              {icon}
            </span>
            <span>{label}</span>
          </span>
        ),
      };
    });

  return {
    ...tree,
    children,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={orderRootSections(pageTree)}
      {...baseOptions}
      sidebar={{ defaultOpenLevel: 0, collapsible: true }}
    >
      {children}
    </DocsLayout>
  );
}
