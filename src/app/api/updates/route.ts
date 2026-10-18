import { listPublished } from "@/lib/updates";
export const dynamic = "force-dynamic";
export async function GET() { try { return Response.json({ updates: await listPublished() }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { console.error("Public updates unavailable", error); return Response.json({ error: "Atualizações indisponíveis" }, { status: 503, headers: { "Cache-Control": "no-store" } }); } }
