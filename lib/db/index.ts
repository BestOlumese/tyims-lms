import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Initialize the PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Export the db instance with the schema attached for relational queries
export const db = drizzle(pool, { schema });