# @better-media/cli

Command Line Tool for the Better Media framework.

## Commands

- `media init`: Bootstrap a `media.config.ts` file in your project.
- `media generate`: Auto-generate database migrations, types, or configuration structures.
- `media status`: Check the status of your Better Media configuration and database connection.

## Installation

```bash
pnpm add -D @better-media/cli
```

## Usage

```bash
# Initialize a new configuration
npx media init

# Generate Drizzle or Prisma schemas based on your media config
npx media generate --target drizzle --out src/db/schema.ts
```

Visit [better-media.dev/docs/cli](https://better-media.dev/docs/cli) for all flags and options.
