import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://ucm:ucm_dev_password@localhost:5432/urban_change_map',
  },
  verbose: true,
  strict: true,
});
