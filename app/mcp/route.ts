import { requireOwner, errorResponse } from "@/lib/owner";
import { draftBatchSchema, runSchema } from "@/lib/editorial-policy";
import { listEditorial, saveDrafts, recordRun } from "@/lib/updates";
export const dynamic = "force-dynamic";
const draftProperties = { title: { type: "string" }, summary: { type: "string" }, relevance: { type: "string" }, limitations: { type: "string" }, sourceUrl: { type: "string", format: "uri" }, organization: { type: "string" }, type: { type: "string", enum: ["announcement", "research", "company_case"] }, eventDate: { type: ["string", "null"] }, publicationDate: { type: "string", description: "YYYY-MM-DD, posterior a 2026-09-08" }, checkedDate: { type: "string", description: "YYYY-MM-DD" } };
const toolDefinitions = [
  { name: "read_editorial", description: "Ler sugestões privadas e a última execução da pesquisa. Exclusivo do autor.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false } },
  { name: "save_research_drafts", description: "Salvar até cinco novidades verificadas como rascunhos privados. Não publica e não altera notícias aprovadas ou descartadas. Apenas fontes oficiais e pesquisas originais posteriores ao TCC.", inputSchema: { type: "object", properties: { drafts: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", properties: draftProperties, required: Object.keys(draftProperties), additionalProperties: false } } }, required: ["drafts"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
  { name: "record_research_run", description: "Registrar resultado da pesquisa semanal, inclusive semanas sem novidades ou falhas. Não publica conteúdo.", inputSchema: { type: "object", properties: { id: { type: "string" }, checkedAt: { type: "string", format: "date-time" }, status: { type: "string", enum: ["success", "partial", "failed"] }, summary: { type: "string" } }, required: ["id", "checkedAt", "status", "summary"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
];
export async function GET() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 50000) return new Response(null, { status: 413 });
  let body: { jsonrpc?: string; id?: string | number; method?: string; params?: { name?: string; arguments?: unknown; protocolVersion?: string } };
  try { const raw = await request.text(); if (raw.length > 50000) return new Response(null, { status: 413 }); body = JSON.parse(raw); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, { status: 400 });
  if (body.id === undefined) return new Response(null, { status: 202 });
  const result = (value: unknown) => Response.json({ jsonrpc: "2.0", id: body.id, result: value }, { headers: { "Cache-Control": "no-store" } });
  if (body.method === "initialize") return result({ protocolVersion: body.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "tcc-pedro-research", version: "1.0.0" }, instructions: "Pesquise fontes oficiais e artigos originais. Todas as novidades permanecem como rascunhos até aprovação do autor em /revisao. Não há ferramenta de publicação." });
  if (body.method === "ping") return result({});
  if (body.method === "tools/list") return result({ tools: toolDefinitions });
  if (body.method !== "tools/call") return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "Method not found" } });
  try {
    await requireOwner(); let value: unknown;
    if (body.params?.name === "read_editorial") value = await listEditorial();
    else if (body.params?.name === "save_research_drafts") { const input = draftBatchSchema.safeParse(body.params.arguments); if (!input.success) return result({ isError: true, content: [{ type: "text", text: "Rascunhos inválidos. Confira campos, fontes HTTPS, datas e limite de cinco." }] }); value = await saveDrafts(input.data.drafts); }
    else if (body.params?.name === "record_research_run") { const input = runSchema.safeParse(body.params.arguments); if (!input.success) return result({ isError: true, content: [{ type: "text", text: "Registro de execução inválido." }] }); value = await recordRun(input.data); }
    else return result({ isError: true, content: [{ type: "text", text: "Ferramenta desconhecida." }] });
    return result({ content: [{ type: "text", text: JSON.stringify(value) }] });
  } catch (error) { return errorResponse(error); }
}
