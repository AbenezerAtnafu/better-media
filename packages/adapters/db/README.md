# @better-media/adapter-db

Database adapters for SQL (Kysely) and metadata persistence.

## Features

- **Kysely Support**: Use with PostgreSQL, MySQL, SQLite, or LibSQL.
- **Drizzle/Prisma Friendly**: Designed to work with your existing schema through migrations.
- **Media Metadata**: Stores and retrieves file metadata, plugin results, and process logs.

## Usage

```ts
import { KyselyDatabaseAdapter } from "@better-media/adapter-db";
import { Kysely, PostgresDialect } from "kysely";

const db = new Kysely({ dialect: new PostgresDialect({ pool }) });
const database = new KyselyDatabaseAdapter(db);
```

For more, visit [better-media.dev/docs/adapters/db](https://better-media.dev/docs/adapters/db).
