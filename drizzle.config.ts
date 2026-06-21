import { defineConfig } from "drizzle-kit";
import "dotenv/config"; // Load env variables for the CLI

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle", // Where migration files will be saved
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});