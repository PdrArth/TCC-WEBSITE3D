import { requireOwner, errorResponse } from "@/lib/owner";
import { listEditorial } from "@/lib/updates";
export const dynamic = "force-dynamic";
export async function GET() { try { await requireOwner(); return Response.json(await listEditorial(), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return errorResponse(error); } }
