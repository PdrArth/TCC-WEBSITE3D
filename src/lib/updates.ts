import { z } from "zod";
import { backendUrl } from "./deployment-backend.mjs";
import type { PublicUpdate } from "./update-types";

const publicUpdate = z.object({
  id: z.string(), title: z.string(), summary: z.string(), relevance: z.string(),
  limitations: z.string(), organization: z.string(),
  sourceUrl: z.string().url().refine(value => new URL(value).protocol === "https:"),
  type: z.enum(["announcement", "research", "company_case"]),
  eventDate: z.string().nullable(), publicationDate: z.string(), checkedDate: z.string(),
  publishedAt: z.string().nullable(),
});
const publicResponse = z.object({
  updates: z.array(publicUpdate.extend({ status: z.literal("published").optional() })).max(30),
});

export async function listPublished(fetcher: typeof fetch = fetch): Promise<PublicUpdate[]> {
  const response = await fetcher(backendUrl("/api/updates"), {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Published updates unavailable (${response.status}).`);
  const payload = publicResponse.parse(await response.json());
  // Whitelist the public fields even if the remote service adds private metadata.
  return payload.updates.map(update => publicUpdate.parse(update));
}
