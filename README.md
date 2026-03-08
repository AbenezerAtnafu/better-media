# Better Media

Modular media pipeline framework for intake, validation, processing, and storage.

## Monorepo Structure

```
packages/
├── core/              # @better-media/core - Types, interfaces, utilities
├── better-media/      # @better-media/sdk - Intake service, pipeline engine
├── plugins/
│   ├── validation-plugin/     # @better-media/plugin-validation
│   ├── virus-scan-plugin/     # @better-media/plugin-virus-scan
│   └── media-processing-plugin/  # @better-media/plugin-media-processing
└── adapters/
    ├── storage/       # @better-media/adapter-storage - Storage interfaces
    └── db/            # @better-media/adapter-db - DB adapter placeholder
```

## Quick Start

```bash
pnpm install
pnpm build
```

## Scripts

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `pnpm build`     | Build all packages                |
| `pnpm dev`       | Watch mode for all packages       |
| `pnpm typecheck` | Type-check all packages           |
| `pnpm lint`      | Lint all packages                 |
| `pnpm test`      | Run tests                         |
| `pnpm format`    | Format with Prettier              |
| `pnpm changeset` | Create a changeset for versioning |

## Adding a Plugin

1. Create `packages/plugins/<name>-plugin/` with `package.json`, `tsconfig.json`, `tsup.config.ts`
2. Implement the `PipelinePlugin` interface from `@better-media/core`
3. Add `@better-media/core` as a workspace dependency

## Adding an Adapter

1. Create `packages/adapters/<name>/` (or add to existing storage/db)
2. Implement the `StorageAdapter` interface from `@better-media/core`
3. Add to workspace in `pnpm-workspace.yaml` if using a new top-level adapter package
