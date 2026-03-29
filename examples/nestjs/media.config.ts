import { Pool } from 'pg';

export default {
  database: new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/better_media',
  }),
  dialect: 'postgres',
  migrationsDir: 'better-media',
};
