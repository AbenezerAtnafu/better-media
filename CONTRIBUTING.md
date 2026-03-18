# Contributing to Better Media

First off, thank you for considering contributing to Better Media! It's people like you who make this project better for everyone.

## Development Environment Setup

This project is a monorepo managed with [pnpm](https://pnpm.io/) and [Turborepo](https://turbo.build/).

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-username/better-media.git
    cd better-media
    ```

2.  **Install dependencies**:

    ```bash
    pnpm install
    ```

3.  **Build all packages**:

    ```bash
    pnpm build
    ```

4.  **Spin up local infrastructure** (Optional but recommended):
    We provide a `docker-compose.yml` to start Redis, MinIO, ClamAV, and Postgres for local development:
    ```bash
    docker compose up -d
    ```

## Development Workflow

- **Watching for changes**: Run `pnpm dev` to start the watch mode for all packages.
- **Running documentation**: Run `pnpm dev --filter @better-media/docs` to start the Fumadocs development server.
- **Testing**: Run `pnpm test` to run tests for all packages. You can filter for a specific package using `pnpm test --filter <package-name>`.

## Submitting a Pull Request

1.  **Branching**: Create a new branch from `main`: `git checkout -b feat/your-feature-name`.
2.  **Changesets**: If your change affects a package's version (new features, bug fixes), please run:
    ```bash
    pnpm changeset
    ```
    Follow the prompts to describe your change.
3.  **Ensure CI passes**: Run `pnpm lint`, `pnpm build`, and `pnpm test` locally before pushing.
4.  **Open the PR**: Push your branch and open a Pull Request on GitHub.

## Code Standards

- **TypeScript**: We use strict TypeScript. Avoid `any` at all costs.
- **Formatting**: We use Prettier. Run `pnpm format` to fix any formatting issues.
- **Architecture**: Always respect the Core / Adapter / Framework separation. Do not add infrastructure dependencies to `@better-media/core`.

Thank you for contributing!
