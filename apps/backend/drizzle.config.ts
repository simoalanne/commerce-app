import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  // The compose development database by default, as in src/config.ts.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/acme_dev",
  },
  // pg-boss owns its schema, and PostGIS its own tables in public.
  schemaFilter: ["public"],
  tablesFilter: ["!spatial_ref_sys"],
  extensionsFilters: ["postgis"],
});
