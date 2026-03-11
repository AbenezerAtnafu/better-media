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

From the monorepo root:

```bash
pnpm install
pnpm build
```

### Sharp (Next.js + media-processing)

The media-processing plugin uses `sharp`, which requires platform-specific binaries. If you see:

```
Could not load the "sharp" module using the darwin-arm64 runtime
```

Run once, then reinstall:

```bash
pnpm approve-builds sharp
pnpm install
```

This allows sharp's postinstall script to download the correct binary for your platform.
