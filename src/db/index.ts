/**
 * Drizzle ORM database client.
 * 
 * This file creates the database connection that all our queries will use.
 * Drizzle is a type-safe ORM — it maps our schema (src/db/schema.ts) to SQL
 * and lets us write queries in TypeScript that catch errors at compile time.
 * 
 * Connection string comes from .env.local:
 * - DATABASE_URL: Transaction pooler (for serverless/Vercel — many short connections)
 * - DATABASE_URL_DIRECT: Direct connection (for migrations — persistent connection)
 * 
 * The transaction pooler uses port 6543 and is optimized for serverless.
 * The direct connection uses port 5432 and is better for long-running migration scripts.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use the transaction pooler for regular app queries (better for serverless)
const connectionString = process.env.DATABASE_URL!;

// Create the postgres connection
const client = postgres(connectionString, {
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
});

// Create the Drizzle client with our schema attached
export const db = drizzle(client, { schema });