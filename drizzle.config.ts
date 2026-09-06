// Next reads .env.local automatically; drizzle-kit does not.
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
