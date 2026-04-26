import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";

export const { getPage, getPages, pageTree } = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
