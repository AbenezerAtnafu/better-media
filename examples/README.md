# Better Media Examples

Starter examples showing how to integrate the Better Media framework.

## Examples

### Next.js

A Next.js App Router application demonstrating client-side usage of the Better Media SDK and plugins.

```bash
cd examples/nextjs
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Express

An Express server demonstrating server-side integration of the Better Media pipeline.

```bash
cd examples/express
pnpm install
pnpm dev
```

Server runs at [http://localhost:3000](http://localhost:3000).

- `GET /` - API info
- `POST /upload` - Simulate file upload (body: `{ "fileKey": "optional", "metadata": {} }`)

## Prerequisites

From the monorepo root, run `pnpm install` and `pnpm build` to build all workspace packages before running examples.
