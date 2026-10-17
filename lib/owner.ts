import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwnerEmail } from "./editorial-policy";
export class AccessError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function requireOwner() {
  const user = await getChatGPTUser();
  if (!user) throw new AccessError(401, "Entre com ChatGPT para continuar.");
  if (!env.TCC_OWNER_EMAIL) throw new AccessError(503, "A área de revisão está temporariamente indisponível.");
  if (!isOwnerEmail(user.email, env.TCC_OWNER_EMAIL)) throw new AccessError(403, "Esta área é exclusiva do autor.");
  return user;
}
export function assertSameOrigin(request: Request) { if (request.headers.get("origin") !== new URL(request.url).origin) throw new AccessError(403, "Origem da solicitação inválida."); }
export function errorResponse(error: unknown) { if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } }); console.error("Editorial operation failed", error); return Response.json({ error: "Não foi possível concluir a operação. Tente novamente." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
