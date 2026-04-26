import { getPage, getPages } from "@/app/source";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { notFound } from "next/navigation";

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;
  const page = getPage(slug);

  if (page == null) {
    notFound();
  }

  const MDX = page.data.body;
  const mdxComponents = getMDXComponents();

  return (
    <DocsPage
      toc={page.data.toc}
      full={false}
      tableOfContent={{ style: "clerk" }}
      tableOfContentPopover={{ style: "clerk" }}
    >
      <DocsBody className="prose-headings:font-headline prose-headings:tracking-tight prose-headings:font-bold prose-code:font-mono prose-pre:font-mono">
        <h1 className="font-headline text-4xl font-black tracking-tight text-foreground md:text-5xl">
          {page.data.title}
        </h1>
        {page.data.description && (
          <p className="mt-2 mb-8 text-lg font-normal leading-relaxed text-muted-foreground">
            {page.data.description}
          </p>
        )}
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);

  if (page == null) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
    },
  };
}
