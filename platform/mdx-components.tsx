import type { MDXComponents } from "mdx/types";
import defaultComponents from "fumadocs-ui/mdx";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { Card, Cards } from "fumadocs-ui/components/card";

const base: MDXComponents = {
  ...defaultComponents,
  Accordion,
  Accordions,
  Callout,
  Tab,
  Tabs,
  Steps,
  Step,
  TypeTable,
  Card,
  Cards,
} as MDXComponents;

/** Pass to compiled MDX (`<Content components={...} />`) — required for Fumadocs MDX 14+ / RSC. */
export function getMDXComponents(overrides: MDXComponents = {}): MDXComponents {
  return { ...base, ...overrides } as MDXComponents;
}

export function useMDXComponents(overrides: MDXComponents): MDXComponents {
  return getMDXComponents(overrides);
}
