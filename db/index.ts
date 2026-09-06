import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and paste the ' +
      'Neon connection string from https://console.neon.tech.',
  );
}

export const db = drizzle(neon(process.env.DATABASE_URL), { schema });
export { schema };
