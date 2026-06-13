import { blog, docs } from "collections/server";
import { loader } from "fumadocs-core/source";

export const { getPage, getPages, pageTree } = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export const { getPage: getBlogPage, getPages: getBlogPages } = loader({
  baseUrl: "/blog",
  source: blog.toFumadocsSource(),
});
