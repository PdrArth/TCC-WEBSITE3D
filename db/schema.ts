import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
export const updates = sqliteTable("updates", {
  id: text("id").primaryKey(), title: text("title").notNull(), summary: text("summary").notNull(), relevance: text("relevance").notNull(), limitations: text("limitations").notNull(),
  sourceUrl: text("source_url").notNull(), organization: text("organization").notNull(), type: text("type", { enum: ["announcement", "research", "company_case"] }).notNull(),
  eventDate: text("event_date"), publicationDate: text("publication_date").notNull(), checkedDate: text("checked_date").notNull(),
  status: text("status", { enum: ["draft", "published", "discarded"] }).notNull().default("draft"), createdAt: text("created_at").notNull(), publishedAt: text("published_at"), revision: integer("revision").notNull().default(1),
}, (table) => [uniqueIndex("updates_source_unique").on(table.sourceUrl)]);
export const researchRuns = sqliteTable("research_runs", { id: text("id").primaryKey(), checkedAt: text("checked_at").notNull(), status: text("status", { enum: ["success", "partial", "failed"] }).notNull(), summary: text("summary").notNull() });
