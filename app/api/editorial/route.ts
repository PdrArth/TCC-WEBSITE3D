import { backendRedirect } from "@/lib/deployment-backend.mjs";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return backendRedirect(request, "/api/editorial");
}
