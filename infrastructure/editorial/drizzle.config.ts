import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./infrastructure/editorial/migrations",
  schema: "./infrastructure/editorial/db/schema.ts",
  dialect: "sqlite",
});
